use crate::ShieldGateway;
use crate::test::utils::deploy_shield_gateway;

use test_common;

#[test]
unconstrained fn test_binned() {
    let (env, _) = test_common::setup_env_and_accounts::<1>();
    let gw_address = deploy_shield_gateway(env);

    let gw = ShieldGateway::at(gw_address);

    // Bin amount is 1_000_000_000
    assert_eq(ShieldGateway::BIN_AMOUNT, 1_000_000_000, "Bin amount is not 1_000_000_000");

    let binned = 5_000_000_000_000;
    assert_eq(
        env.simulate_utility(gw.binned(binned * ShieldGateway::BIN_AMOUNT)),
        binned,
        f"Bin amount is not {binned}",
    );

    let binned = 1_000_000_000_000;
    assert_eq(
        env.simulate_utility(gw.binned(binned * ShieldGateway::BIN_AMOUNT)),
        binned,
        f"Bin amount is not {binned}",
    );

    let binned = 1_000;
    assert_eq(
        env.simulate_utility(gw.binned(binned * ShieldGateway::BIN_AMOUNT)),
        binned,
        f"Bin amount is not {binned}",
    );

    assert_eq(
        env.simulate_utility(gw.binned(ShieldGateway::BIN_AMOUNT + 1)),
        1,
        "Bin amount is not 1",
    );
    assert_eq(env.simulate_utility(gw.binned(ShieldGateway::BIN_AMOUNT)), 1, "Bin amount is not 1");
    assert_eq(
        env.simulate_utility(gw.binned(ShieldGateway::BIN_AMOUNT - 1)),
        0,
        "Bin amount is not 0",
    );
    assert_eq(env.simulate_utility(gw.binned(1)), 0, "Bin amount is not 0");
    assert_eq(env.simulate_utility(gw.binned(0)), 0, "Bin amount is not 0");
}
