use crate::test::utils;
use crate::Token;
use test_common;

#[test]
unconstrained fn shield() {
    let (env, accounts) = test_common::setup_env_and_accounts::<2>();

    let minter = accounts[0];
    let recipient = accounts[1];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000;
    utils::mint(env, token, minter, recipient, amount);

    utils::check_balance_public(env, token, minter, 0);
    utils::check_balance_public(env, token, recipient, amount);

    env.impersonate(recipient);
    Token::at(token).shield(recipient, amount, 0).call(&mut env.private());

    env.advance_block_by(1);

    // Public balance should be 0
    utils::check_balance_public(env, token, recipient, 0);

    // Private balance should be `amount`
    utils::check_balance_private(token, recipient, amount);
}

#[test]
unconstrained fn unshield() {
    let (env, accounts) = test_common::setup_env_and_accounts::<2>();

    let minter = accounts[0];
    let recipient = accounts[1];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000;

    utils::mint_shielded(env, token, minter, recipient, amount);
    utils::check_balance_private(token, recipient, amount);

    env.impersonate(recipient);
    Token::at(token).unshield(recipient, amount, 0).call(&mut env.private());

    // Public balance should be `amount`
    utils::check_balance_public(env, token, recipient, amount);

    // Private balance should be 0
    utils::check_balance_private(token, recipient, 0);
}
