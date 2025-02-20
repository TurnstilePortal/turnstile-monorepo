mod test;

use aztec::macros::aztec;

#[aztec]
pub contract Beacon {
    use aztec::{
        context::PublicContext,
        event::event_interface::EventInterface,
        macros::{events::event, functions::{initializer, private, public, view}, storage::storage},
        protocol_types::{address::AztecAddress, traits::{FromField, Serialize, ToField}},
        state_vars::{Map, PublicMutable, SharedMutable},
        unencrypted_logs::unencrypted_event_emission::encode_event,
    };

    use authwit::auth::assert_current_call_valid_authwit_public;

    pub global CHANGE_DELAY_BLOCKS: u32 = 5;

    #[storage]
    struct Storage<Context> {
        target: SharedMutable<AztecAddress, CHANGE_DELAY_BLOCKS, Context>,
        overrides: Map<AztecAddress, SharedMutable<AztecAddress, CHANGE_DELAY_BLOCKS, Context>, Context>,
        admin: PublicMutable<AztecAddress, Context>,
    }

    #[derive(Serialize)]
    #[event]
    struct TargetChangeScheduled {
        old_target: AztecAddress,
        new_target: AztecAddress,
        effective_block: Field,
    }

    #[derive(Serialize)]
    #[event]
    struct TargetOverrideChangeScheduled {
        source: AztecAddress,
        old_target: AztecAddress,
        new_target: AztecAddress,
        effective_block: Field,
    }

    #[derive(Serialize)]
    #[event]
    struct AdminChanged {
        old_admin: AztecAddress,
        new_admin: AztecAddress,
    }

    #[public]
    #[initializer]
    fn init(admin: AztecAddress, target: AztecAddress) {
        _update_admin(&mut context, storage, admin);
        _update_target(&mut context, storage, target);
    }

    #[public]
    fn set_target(from: AztecAddress, new_target: AztecAddress, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        assert(from == storage.admin.read(), "Only admin can set beacon target");

        _update_target(&mut context, storage, new_target);
    }

    #[public]
    fn set_target_override(
        from: AztecAddress,
        source: AztecAddress,
        target: AztecAddress,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        assert(from == storage.admin.read(), "Only admin can set beacon target");

        _update_target_override(&mut context, storage, source, target);
    }

    #[public]
    fn set_admin(from: AztecAddress, new_admin: AztecAddress, nonce: Field) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }
        assert(from == storage.admin.read(), "Only admin can set admin");

        _update_admin(&mut context, storage, new_admin);
    }

    #[contract_library_method]
    fn _update_admin(
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
        new_admin: AztecAddress,
    ) {
        AdminChanged { old_admin: storage.admin.read(), new_admin: new_admin }.emit(encode_event(
            context,
        ));
        storage.admin.write(new_admin);
    }

    #[contract_library_method]
    fn _update_target(
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
        new_target: AztecAddress,
    ) {
        TargetChangeScheduled {
            old_target: storage.target.get_current_value(),
            new_target: new_target,
            effective_block: context.block_number() + CHANGE_DELAY_BLOCKS.to_field(),
        }
            .emit(encode_event(context));

        storage.target.schedule_value_change(new_target)
    }

    #[contract_library_method]
    fn _update_target_override(
        context: &mut PublicContext,
        storage: Storage<&mut PublicContext>,
        source: AztecAddress,
        new_target: AztecAddress,
    ) {
        TargetOverrideChangeScheduled {
            source: source,
            old_target: storage.overrides.at(source).get_current_value(),
            new_target: new_target,
            effective_block: context.block_number() + CHANGE_DELAY_BLOCKS.to_field(),
        }
            .emit(encode_event(context));

        storage.overrides.at(source).schedule_value_change(new_target);
    }

    #[public]
    #[view]
    fn get_target_public(source: AztecAddress) -> pub AztecAddress {
        let mut target = storage.overrides.at(source).get_current_value();
        if (target.is_zero()) {
            target = storage.target.get_current_value();
        }
        target
    }

    #[private]
    fn get_target_private(source: AztecAddress) -> pub AztecAddress {
        let mut target = storage.overrides.at(source).get_current_value();
        if (target.is_zero()) {
            target = storage.target.get_current_value();
        }
        target
    }

    #[public]
    #[view]
    fn get_admin_public() -> pub AztecAddress {
        storage.admin.read()
    }

    pub unconstrained fn get_target_unconstrained(source: AztecAddress) -> pub AztecAddress {
        let mut target = storage.overrides.at(source).get_current_value();
        if (target.is_zero()) {
            target = storage.target.get_current_value();
        }
        storage.target.get_current_value()
    }

    pub unconstrained fn get_default_target_unconstrained() -> pub AztecAddress {
        storage.target.get_current_value()
    }

    pub unconstrained fn get_admin_unconstrained() -> pub AztecAddress {
        storage.admin.read()
    }
}
