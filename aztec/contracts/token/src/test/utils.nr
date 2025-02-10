use aztec::{
    oracle::{execution::get_contract_address, random::random},
    prelude::{AztecAddress, NoteHeader},
    protocol_types::{
        storage::map::derive_storage_slot_in_map,
        traits::ToField,
    },
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
};

use std::mem::zeroed;
use std::test::OracleMock;

use crate::Token;
use beacon::test::utils as beacon_utils;
use uint253::uint253_note::U253Note;

// Setup a test environment with N accounts
pub unconstrained fn setup<let N: u32>() -> (&mut TestEnvironment, [AztecAddress; N]) {
    let mut env = TestEnvironment::new();
    let mut accounts = [AztecAddress::zero(); N];
    for i in 0..N {
        accounts[i] = env.create_account_contract(i.to_field());
    }

    env.advance_block_by(1);
    (&mut env, accounts)
}

unconstrained fn nullPad<let N: u32, let M: u32>(input: str<M>) -> str<N> {
    assert(M <= N, "Input string is too long!");

    // N-sized array of null bytes
    let mut padded: [u8; N] = zeroed();

    // Copy in the input string
    let input_bytes = input.as_bytes();
    for i in 0..M {
        padded[i] = input_bytes[i];
    }

    padded.as_str_unchecked()
}

pub unconstrained fn deploy_token(
    env: &mut TestEnvironment,
    minter: AztecAddress,
    shield_gateway: AztecAddress,
) -> AztecAddress {
    let beacon = beacon_utils::deploy_beacon(env, AztecAddress::zero(), shield_gateway);
    let init_call =
        Token::interface().init(minter, nullPad("TestToken"), nullPad("TT"), 18);
    let token = env.deploy("./@token", "Token").with_public_void_initializer(init_call);

    // set the shield gateway
    env.impersonate(minter);
    Token::at(token.to_address()).set_shield_gateway_beacon(beacon).call(&mut env.public());
    env.advance_block_by(1);

    token.to_address()
}

pub unconstrained fn mint(
    env: &mut TestEnvironment,
    token: AztecAddress,
    minter: AztecAddress,
    recipient: AztecAddress,
    amount: Field,
) {
    env.impersonate(minter);
    Token::at(token).mint_public(recipient, amount).call(&mut env.public());
}

pub unconstrained fn prepare_private_balance_increase(
    env: &mut TestEnvironment,
    token: AztecAddress,
    sender: AztecAddress,
    recipient: AztecAddress,
) -> (Field, Field) {
    let note_randomness = random();
    // Mock Oracle so that we can manually add the note
    let mock = OracleMock::mock("getRandomField").returns(note_randomness);

    let hiding_point_slot: Field = Token::at(token)
        .prepare_private_balance_increase(sender, recipient)
        .call(&mut env.private());

    OracleMock::clear(mock);

    (note_randomness, hiding_point_slot)
}

pub unconstrained fn mint_shielded(
    env: &mut TestEnvironment,
    token: AztecAddress,
    minter: AztecAddress,
    recipient: AztecAddress,
    amount: Field,
) {
    env.impersonate(minter);
    let (note_randomness, hiding_point_slot) =
        prepare_private_balance_increase(env, token, minter, recipient);

    Token::at(token).finalize_mint_shielded(recipient, amount, hiding_point_slot).call(
        &mut env.public(),
    );

    // We need to manually add the note because #8771 has not yet been implemented
    add_token_note(env, token, recipient, amount, note_randomness);
}

pub unconstrained fn shield(
    env: &mut TestEnvironment,
    token: AztecAddress,
    sender: AztecAddress,
    amount: Field,
) {
    env.impersonate(sender);
    let (note_randomness, hiding_point_slot) =
        prepare_private_balance_increase(env, token, sender, sender);

    Token::at(token).finalize_transfer_public_to_private(amount, hiding_point_slot).call(
        &mut env.public(),
    );

    // We need to manually add the note because #8771 has not yet been implemented
    add_token_note(env, token, sender, amount, note_randomness);
}

pub unconstrained fn transfer(
    env: &mut TestEnvironment,
    token: AztecAddress,
    sender: AztecAddress,
    recipient: AztecAddress,
    amount: Field,
) {
    env.impersonate(sender);
    Token::at(token).transfer_public_to_public(sender, recipient, amount, 0.to_field()).call(
        &mut env.public(),
    );
}

pub unconstrained fn check_balance_public(
    env: &mut TestEnvironment,
    token: AztecAddress,
    account: AztecAddress,
    amount: Field,
) {
    let balance = Token::at(token).balance_of_public(account).view(&mut env.public());
    assert(balance.eq(amount), f"Public balance {balance} should be equal to {amount}");
}

pub unconstrained fn print_balance_private<let N: u32>(
    msg: str<N>,
    token: AztecAddress,
    account: AztecAddress,
) {
    let current = get_contract_address();
    cheatcodes::set_contract_address(token);
    let balance = Token::balance_of_private(account);

    let account = account.to_field();
    std::println(f"{msg} Private balance {account}: {balance}");
    cheatcodes::set_contract_address(current);
}

pub unconstrained fn check_balance_private(
    token: AztecAddress,
    account: AztecAddress,
    amount: Field,
) {
    let current = get_contract_address();
    cheatcodes::set_contract_address(token);
    let balance = Token::balance_of_private(account);

    assert(balance == amount, f"Private balance {balance} should be equal to amount {amount}");
    cheatcodes::set_contract_address(current);
}

// TODO(#8771): We need to manually add the note because in the partial notes flow `notify_created_note_oracle`
// is not called and we don't have a `NoteProcessor` in TXE.
pub unconstrained fn add_token_note(
    env: &mut TestEnvironment,
    token_contract_address: AztecAddress,
    owner: AztecAddress,
    amount: Field,
    note_randomness: Field,
) {
    let balances_owner_slot =
        derive_storage_slot_in_map(Token::storage_layout().private_balances.slot, owner);

    env.add_note(
        &mut U253Note {
            value: amount,
            owner: owner,
            randomness: note_randomness,
            header: NoteHeader::empty(),
        },
        balances_owner_slot,
        token_contract_address,
    );
}
