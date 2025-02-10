use crate::test::utils;
use crate::Token;

#[test]
unconstrained fn shield() {
    let (env, accounts) = utils::setup::<3>();

    let minter = accounts[0];
    let recipient = accounts[1];
    let shield_gateway = accounts[2];
    let token = utils::deploy_token(env, minter, shield_gateway);
    let amount = 1000000000000000000;
    utils::mint(env, token, minter, recipient, amount);

    utils::check_balance_public(env, token, minter, 0);
    utils::check_balance_public(env, token, recipient, amount);

    // This doesn't actually call `Token.shield()` but rather `Token.finalize_transfer_public_to_private()`
    utils::shield(env, token, recipient, amount);

    // Public balance should be 0
    utils::check_balance_public(env, token, recipient, 0);

    // Private balance should be `amount`
    utils::check_balance_private(token, recipient, amount);
}

#[test]
unconstrained fn unshield() {
    let (env, accounts) = utils::setup::<3>();

    let minter = accounts[0];
    let recipient = accounts[1];
    let shield_gateway = accounts[2];
    let token = utils::deploy_token(env, minter, shield_gateway);
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
