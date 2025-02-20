use aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use crate::test::utils;
use crate::Token;
use test_common;

#[test]
unconstrained fn mint_public() {
    let (env, accounts) = test_common::setup_env_and_accounts::<2>();

    let minter = accounts[0];
    let recipient = accounts[1];

    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000;
    utils::mint(env, token, minter, recipient, amount);
    utils::check_balance_public(env, token, minter, 0);
    utils::check_balance_public(env, token, recipient, amount);
}

#[test]
unconstrained fn mint_shielded() {
    let (env, accounts) = test_common::setup_env_and_accounts::<2>();

    let minter = accounts[0];
    let recipient = accounts[1];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000;

    env.impersonate(minter);
    Token::at(token).mint_shielded(recipient, amount).call(&mut env.private());
    env.advance_block_by(1);
    utils::check_balance_private(token, recipient, amount);
}
