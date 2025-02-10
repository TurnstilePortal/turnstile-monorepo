use crate::ShieldGatewayStorage;
use crate::test::utils;

use aztec::protocol_types::traits::FromField;
use uint253::uint253::U253;

#[test]
unconstrained fn test_initialize_channel_balance() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let caller = accounts[1];
    let owner = accounts[2];
    let storage = ShieldGatewayStorage::at(storage_address);


    let key = 3;
    let value = U253::from_field(4);

    assert(!utils::is_channel_initialized(storage_address, key), "Value should not be initialized");

    env.impersonate(caller);
    let initialized_value = storage.initialize_channel_balance(key, value, owner).call(&mut env.private());
    assert(value == initialized_value, f"Initialized value: expected {value}, got {initialized_value}");

    env.advance_block_by(1);

    assert(utils::is_channel_initialized(storage_address, key), "Value should be initialized");
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn test_initialize_fails_with_wrong_caller() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let storage = ShieldGatewayStorage::at(storage_address);

    let key = 5;
    let value = U253::from_field(6);

    let owner = accounts[2];
    env.impersonate(owner);
    let _ = storage.initialize_channel_balance(key, value, owner).call(&mut env.private());
}

#[test]
unconstrained fn test_get_channel_balance() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let caller = accounts[1];
    let owner = accounts[2];
    let storage = ShieldGatewayStorage::at(storage_address);


    let key = 3;
    let value = U253::from_field(4);

    env.impersonate(caller);
    let _ = storage.initialize_channel_balance(key, value, owner).call(&mut env.private());

    let stored_value = storage.get_channel_balance(key).view(&mut env.private());
    assert(value == stored_value, f"Stored value: expected {value}, got {stored_value}");
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn test_get_channel_balance_fails_with_wrong_caller() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let storage = ShieldGatewayStorage::at(storage_address);
    let caller = accounts[1];

    let key = 5;

    let owner = accounts[2];
    env.impersonate(caller);
    let _ = storage.initialize_channel_balance(key, U253::zero(), owner).call(&mut env.private());

    env.impersonate(owner);
    let _ = storage.get_channel_balance(key).view(&mut env.private());
}

#[test]
unconstrained fn test_set_channel_balance() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let caller = accounts[1];
    let owner = accounts[2];
    let storage = ShieldGatewayStorage::at(storage_address);


    let key = 3;
    let value = U253::from_field(4);

    env.impersonate(caller);
    let _ = storage.initialize_channel_balance(key, U253::zero(), owner).call(&mut env.private());
    let set_result = storage.set_channel_balance(key, value, owner).call(&mut env.private());
    assert(value == set_result, "Failed to set value");


    let stored_value = storage.get_channel_balance(key).view(&mut env.private());
    assert(value == stored_value, f"Stored value: expected {value}, got {stored_value}");
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn test_set_channel_balance_fails_with_wrong_caller() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let storage = ShieldGatewayStorage::at(storage_address);
    let caller = accounts[1];
    let owner = accounts[2];

    let key = 5;

    env.impersonate(caller);
    let _ = storage.initialize_channel_balance(key, U253::zero(), owner).call(&mut env.private());

    env.impersonate(owner);
    let _ = storage.set_channel_balance(key, U253::zero(), owner).view(&mut env.private());
}
