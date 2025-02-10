mod test;

use aztec::macros::aztec;

#[aztec]
pub contract ShieldGatewayStorage {

    use aztec::{
        context::PrivateContext,
        encrypted_logs::log_assembly_strategies::default_aes128::note::encode_and_encrypt_note,
        macros::{functions::{initializer, private, public, view}, storage::storage},
        protocol_types::{
            address::AztecAddress,
            traits::{FromField, Hash, Serialize},
        },
        state_vars::{Map, PrivateMutable, PublicImmutable, SharedMutable},
    };

    use uint253::{uint253::U253, uint253_note::U253Note};

    pub global CHANGE_DELAY_BLOCKS: u32 = 5;

    #[storage]
    struct Storage<Context> {
        admin: PublicImmutable<AztecAddress, Context>,
        authorized_caller: SharedMutable<AztecAddress, CHANGE_DELAY_BLOCKS, Context>,
        channel_balances: Map<Field, PrivateMutable<U253Note, Context>, Context>,
        channel_thresholds: Map<AztecAddress, SharedMutable<U253, CHANGE_DELAY_BLOCKS, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn init(admin: AztecAddress) {
        storage.admin.initialize(admin);
    }

    #[public]
    fn set_authorized_caller(caller: AztecAddress) {
        assert(context.msg_sender() == storage.admin.read(), "Only the admin can set the authorized caller");
        storage.authorized_caller.schedule_value_change(caller);
    }

    #[contract_library_method]
    fn _assert_caller_is_authorized(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
    ) {
        assert(context.msg_sender() == storage.authorized_caller.get_current_value(), "Unauthorized");
    }

    pub unconstrained fn is_channel_initialized_unconstrained(key: Field) -> bool {
        storage.channel_balances.at(key).is_initialized()
    }

    #[private]
    #[view]
    fn is_channel_initialized(key: Field) -> bool {
        _assert_caller_is_authorized(&mut context, storage);
        // Safety: `initialize` must be called if the key is uninitialized, so the caller
        // must attempt initialization for uninitialized keys to constrain this value
        unsafe {
            is_channel_initialized_unconstrained(key)
        }
    }

    #[private]
    fn get_channel_balance(key: Field) -> U253 {
        _assert_caller_is_authorized(&mut context, storage);
        storage.channel_balances.at(key).get_note().note.get_value()
    }

    #[private]
    fn initialize_channel_balance(key: Field, value: U253, owner: AztecAddress) -> U253 {
        _assert_caller_is_authorized(&mut context, storage);
        let mut note = U253Note::new(value, owner);
        storage.channel_balances.at(key).initialize(&mut note).emit(encode_and_encrypt_note(
            &mut context,
            owner,
            owner,
        ));
        value
    }

    #[private]
    fn set_channel_balance(key: Field, value: U253, owner: AztecAddress) -> U253 {
        _assert_caller_is_authorized(&mut context, storage);
        let mut note = U253Note::new(value, owner);
        storage.channel_balances.at(key).replace(&mut note).emit(encode_and_encrypt_note(
            &mut context,
            owner,
            owner,
        ));
        value
    }

    #[public]
    #[view]
    fn get_channel_threshold(key: AztecAddress) -> U253 {
        storage.channel_thresholds.at(key).get_current_value()
    }

    #[private]
    #[view]
    fn get_channel_threshold_private(key: AztecAddress) -> U253 {
        storage.channel_thresholds.at(key).get_current_value()
    }

    #[public]
    fn set_channel_threshold(key: AztecAddress, value: U253) -> U253 {
        assert(context.msg_sender() == storage.authorized_caller.get_current_value(), "Unauthorized");
        storage.channel_thresholds.at(key).schedule_value_change(value);
        value
    }

    unconstrained pub fn get_authorized_caller_unconstrained() -> AztecAddress {
        storage.authorized_caller.get_current_value()
    }

    unconstrained pub fn get_admin_unconstrained() -> AztecAddress {
        storage.admin.read()
    }
}
