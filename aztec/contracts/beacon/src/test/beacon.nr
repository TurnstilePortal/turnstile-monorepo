use crate::Beacon;
use crate::test::utils;

use test_common;

#[test]
unconstrained fn beacon_setup() {
    let (env, accounts) = test_common::setup_env_and_accounts::<2>();

    let admin = accounts[0];
    let target = accounts[1];

    let beacon_address = utils::deploy_beacon(env, admin, target);

    let beacon = Beacon::at(beacon_address);

    let default_target = beacon.get_target_public(admin).view(&mut env.public());
    assert(target == default_target, "Beacon target not set correctly");

    let beacon_admin = beacon.get_admin_public().view(&mut env.public());
    assert(admin == beacon_admin, "Beacon admin not set correctly");
}

#[test]
unconstrained fn beacon_targets() {
    let (env, accounts) = test_common::setup_env_and_accounts::<5>();

    let admin = accounts[0];
    let target1 = accounts[1];
    let target2 = accounts[2];
    let target3 = accounts[3];
    let override_source = accounts[4];

    let beacon_address = utils::deploy_beacon(env, admin, target1);

    let beacon = Beacon::at(beacon_address);

    let default_target = beacon.get_target_public(admin).view(&mut env.public());
    assert(target1 == default_target, "Beacon target not set correctly");

    let still_default_target = beacon.get_target_public(override_source).view(&mut env.public());
    assert(target1 == still_default_target, "Beacon target not set correctly");

    // set target override override_source -> target2
    env.impersonate(admin);
    beacon.set_target_override(admin, override_source, target2, 0).call(&mut env.public());
    // advance to when override takes effect
    env.advance_block_by(Beacon::CHANGE_DELAY_BLOCKS);

    let overide_target = beacon.get_target_public(override_source).view(&mut env.public());
    assert(target2 == overide_target, "Beacon target override not set correctly");

    // change the default target to target3
    beacon.set_target(admin, target3, 0).call(&mut env.public());
    // advance to when new default target takes effect
    env.advance_block_by(Beacon::CHANGE_DELAY_BLOCKS);

    let new_default_target = beacon.get_target_public(admin).view(&mut env.public());
    assert(target3 == new_default_target, "Beacon target not set correctly");

    // check that the override is still target2
    let still_overide_target = beacon.get_target_public(override_source).view(&mut env.public());
    assert(target2 == still_overide_target, "Beacon target override not set correctly");
}

#[test]
unconstrained fn beacon_private() {
    let (env, accounts) = test_common::setup_env_and_accounts::<4>();

    let admin = accounts[0];
    let target1 = accounts[1];
    let target2 = accounts[2];
    let caller = accounts[3];

    let beacon_address = utils::deploy_beacon(env, admin, target1);
    let beacon = Beacon::at(beacon_address);

    let default_target = beacon.get_target_private(admin).view(&mut env.private());
    assert(target1 == default_target, "Beacon target not set correctly");

    env.impersonate(admin);
    beacon.set_target_override(admin, caller, target2, 0).call(&mut env.public());

    env.advance_block_by(Beacon::CHANGE_DELAY_BLOCKS + 1);

    let overide_target = beacon.get_target_private(caller).view(&mut env.private());
    assert(target2 == overide_target, "Beacon target override not set correctly");
}
