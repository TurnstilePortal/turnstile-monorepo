use crate::test::utils;

#[test]
unconstrained fn transfer_public() {
    let (env, accounts) = utils::setup::<4>();

    let minter = accounts[0];
    let sender = accounts[1];
    let recipient = accounts[2];
    let shield_gateway = accounts[3];
    let token = utils::deploy_token(env, minter, shield_gateway);
    let amount = 1000000000000000000.to_field();
    utils::mint(env, token, minter, sender, amount);

    utils::check_balance_public(env, token, sender, amount);
    utils::check_balance_public(env, token, recipient, 0);

    utils::transfer(env, token, sender, recipient, amount);

    utils::check_balance_public(env, token, sender, 0);
    utils::check_balance_public(env, token, recipient, amount);
}
