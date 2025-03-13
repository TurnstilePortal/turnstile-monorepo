use crate::test::utils;
use crate::Token;
use test_common;

#[test]
unconstrained fn transfer_public() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let token = utils::deploy_token(env, minter);
    let amount: u128 = 1_000_000_000_000_000_000;
    utils::mint(env, token, minter, sender, amount);

    utils::check_balance_public(env, token, sender, amount);
    utils::check_balance_public(env, token, recipient, 0);

    env.impersonate(sender);
    Token::at(token).transfer_public_to_public(sender, recipient, amount, 0).call(&mut env.public());

    utils::check_balance_public(env, token, sender, 0);
    utils::check_balance_public(env, token, recipient, amount);
}
