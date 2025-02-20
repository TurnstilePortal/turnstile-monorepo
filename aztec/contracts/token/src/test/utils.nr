use aztec::{
    oracle::{capsules, execution::get_contract_address, random::random},
    prelude::AztecAddress,
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
};

use std::mem::zeroed;

use crate::Token;
use beacon::test::utils as beacon_utils;
use shield_gateway::{ShieldGateway, test::utils as shield_gateway_utils};

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
    env.advance_block_by(1);

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
    env.advance_block_by(1);
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

pub unconstrained fn store_vp_capsule(env: &mut TestEnvironment, token: AztecAddress) {
    let vp = [random(), random(), random(), random(), random()];
    let shield_gateway = Token::at(token).get_shield_gateway_private().view(&mut env.private());

    let current = get_contract_address();
    cheatcodes::set_contract_address(shield_gateway);
    capsules::store(shield_gateway, ShieldGateway::VP_SLOT, vp);

    cheatcodes::set_contract_address(current);
}
