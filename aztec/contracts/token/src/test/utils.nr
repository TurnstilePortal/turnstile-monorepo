use aztec::{
    oracle::{execution::get_contract_address, random::random},
    prelude::{AztecAddress, NoteHeader},
    protocol_types::{storage::map::derive_storage_slot_in_map, traits::ToField},
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
};

use std::mem::zeroed;
use std::test::OracleMock;

use crate::Token;
use beacon::test::utils as beacon_utils;
use shield_gateway::test::utils as shield_gateway_utils;
use uint253::uint253_note::U253Note;

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

pub unconstrained fn deploy_token(env: &mut TestEnvironment, minter: AztecAddress) -> AztecAddress {
    let shield_gateway = shield_gateway_utils::deploy_shield_gateway(env);
    let beacon = beacon_utils::deploy_beacon(env, AztecAddress::zero(), shield_gateway);
    let init_call = Token::interface().init(minter, nullPad("TestToken"), nullPad("TT"), 18);
    let token = env.deploy("./@token", "Token").with_public_void_initializer(init_call);

    // set the shield gateway
    env.impersonate(minter);
    aztec::oracle::debug_log::debug_log("deploy_token:  setting shield gateway...");
    Token::at(token.to_address()).set_shield_gateway_beacon(beacon).call(&mut env.public());
    aztec::oracle::debug_log::debug_log("deploy_token:  shield gateway set...");
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
