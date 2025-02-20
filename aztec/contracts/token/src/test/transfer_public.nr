use crate::test::utils;
use test_common;

#[test]
unconstrained fn transfer_public() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000.to_field();
    utils::mint(env, token, minter, sender, amount);

    utils::check_balance_public(env, token, sender, amount);
    utils::check_balance_public(env, token, recipient, 0);

    utils::transfer(env, token, sender, recipient, amount);

    utils::check_balance_public(env, token, sender, 0);
    utils::check_balance_public(env, token, recipient, amount);
}
