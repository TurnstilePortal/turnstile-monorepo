use crate::ShieldGatewayStorage;
use crate::test::utils;

use aztec::protocol_types::{
    address::AztecAddress,
    traits::FromField,
};

use uint253::uint253::U253;


#[test]
unconstrained fn test_get_channel_threshold() {
    let (env, storage_address, accounts) = utils::setup_storage::<2>();
    let caller = accounts[1];
    let storage = ShieldGatewayStorage::at(storage_address);

    let key = AztecAddress::from_field(1);
    let value = U253::from_field(4);

    env.impersonate(caller);
    let _ = storage.set_channel_threshold(key, value).call(&mut env.public());
    env.advance_block_by(ShieldGatewayStorage::CHANGE_DELAY_BLOCKS + 1);

    let stored_value = storage.get_channel_threshold(key).view(&mut env.public());
    assert(value == stored_value, f"Stored value: expected {value}, got {stored_value}");
}

#[test]
unconstrained fn test_set_channel_threshold() {
    let (env, storage_address, accounts) = utils::setup_storage::<2>();
    let caller = accounts[1];
    let storage = ShieldGatewayStorage::at(storage_address);

    let key = AztecAddress::from_field(1);
    let value = U253::from_field(4);

    env.impersonate(caller);
    let set_result = storage.set_channel_threshold(key, value).call(&mut env.public());
    assert(value == set_result, "Failed to set value");

    env.advance_block_by(ShieldGatewayStorage::CHANGE_DELAY_BLOCKS + 1);

    let stored_value = storage.get_channel_threshold(key).view(&mut env.public());
    assert(value == stored_value, f"Stored value: expected {value}, got {stored_value}");
}

#[test(should_fail_with = "Unauthorized")]
unconstrained fn test_set_channel_threshold_fails_with_wrong_caller() {
    let (env, storage_address, accounts) = utils::setup_storage::<3>();
    let storage = ShieldGatewayStorage::at(storage_address);

    let key = AztecAddress::from_field(1);
    let value = U253::from_field(6);

    let not_caller = accounts[2];
    env.impersonate(not_caller);
    let _ = storage.set_channel_threshold(key, value).call(&mut env.public());
}
