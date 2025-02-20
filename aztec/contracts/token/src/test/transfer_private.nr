use crate::test::utils;
use crate::Token;
use test_common;

#[test]
unconstrained fn transfer_private_to_private() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];

    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000.to_field();

    utils::mint_shielded(env, token, minter, sender, amount);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    env.impersonate(sender);
    Token::at(token).transfer_private_to_private(sender, recipient, amount, 0).call(
        &mut env.private(),
    );
    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}

#[test]
unconstrained fn transfer_private_to_private_twice() {
    let (env, accounts) = test_common::setup_env_and_accounts::<3>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let token = utils::deploy_token(env, minter);
    let amount = 1000000000000000000.to_field();
    let half = amount / 2;

    utils::mint_shielded(env, token, minter, sender, amount);

    utils::check_balance_private(token, sender, amount);
    utils::check_balance_private(token, recipient, 0);

    env.impersonate(sender);
    Token::at(token).transfer_private_to_private(sender, recipient, half, 0).call(&mut env.private());

    Token::at(token).transfer_private_to_private(sender, recipient, half, 0).call(&mut env.private());

    utils::check_balance_private(token, sender, 0);
    utils::check_balance_private(token, recipient, amount);
}
