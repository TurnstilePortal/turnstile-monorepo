mod capsule;
mod test;

use aztec::macros::aztec;

#[aztec]
pub contract ShieldGateway {
    use std::meta::derive;
    use std::ops::arith::Add;

    use aztec::{
        context::{PrivateContext, PublicContext},
        event::event_interface::EventInterface,
        macros::{
            events::event,
            functions::{initializer, internal, private, public, view},
            storage::storage,
        },
        protocol_types::{
            address::AztecAddress,
            hash::poseidon2_hash,
            traits::{
                FromField,
                Hash,
                ToField,
                Serialize,
            },
        },
        state_vars::{PublicImmutable, SharedMutable},
        unencrypted_logs::unencrypted_event_emission::encode_event,
    };

    use authwit::auth::assert_current_call_valid_authwit;

    use shield_gateway_storage::ShieldGatewayStorage;
    use token::Token;
    use uint253::uint253::U253;

    use crate::capsule::pop_capsule;

    pub global CHANGE_DELAY_BLOCKS: u32 = 5;

    #[storage]
    struct Storage<Context> {
        admin: PublicImmutable<AztecAddress, Context>,
        default_channel_threshold: SharedMutable<U253, CHANGE_DELAY_BLOCKS, Context>,
        // External contract to hold the channel balances
        shield_gateway_storage: PublicImmutable<AztecAddress, Context>,
    }

    #[derive(Serialize)]
    #[event]
    struct ChannelCreation {
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
    }

    #[derive(Serialize)]
    #[event]
    struct ChannelThresholdExceeded {
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
    }

    #[derive(Serialize)]
    #[event]
    struct DefaultChannelThresholdChanged {
        new_threshold: Field,
        effective_block: Field,
    }

    #[derive(Serialize)]
    #[event]
    struct ChannelThresholdChanged {
        new: Field,
        token: AztecAddress,
        effective_block: Field,
    }

    #[public]
    #[initializer]
    fn init(admin: AztecAddress, shield_gateway_storage: AztecAddress, default_channel_threshold: Field) {
        storage.admin.initialize(admin);
        storage.shield_gateway_storage.initialize(shield_gateway_storage);
        _set_default_channel_threshold(&mut context, storage, default_channel_threshold);
    }

    pub unconstrained fn get_default_channel_threshold() -> Field {
        storage.default_channel_threshold.get_current_value().to_field()
    }

    #[public]
    #[view]
    fn get_channel_threshold(token: AztecAddress) -> U253 {
        let mut threshold = ShieldGatewayStorage::at(storage.shield_gateway_storage.read()).get_channel_threshold(token).view(&mut context);
        if threshold.is_zero() {
            threshold = storage.default_channel_threshold.get_current_value();
        }
        threshold
    }

    #[contract_library_method]
    fn _assert_only_admin(context: &mut PublicContext, storage: Storage<&mut PublicContext>) {
        assert(
            context.msg_sender().eq(storage.admin.read()),
            "Unauthorized",
        );
    }

    #[public]
    fn set_default_channel_threshold(new_threshold: Field) {
        _assert_only_admin(&mut context, storage);
        _set_default_channel_threshold(&mut context, storage, new_threshold);
    }

    #[public]
    fn set_channel_threshold(token: AztecAddress, new_threshold: Field) {
        _assert_only_admin(&mut context, storage);

        let new_threshold = U253::from_field(new_threshold);

        let _ = ShieldGatewayStorage::at(storage.shield_gateway_storage.read()).set_channel_threshold(token, new_threshold).call(&mut context);

        ChannelThresholdChanged {
            new: new_threshold.to_field(),
            token,
            // Change will be effective after `CHANGE_DELAY_BLOCKS` in public context and `CHANGE_DELAY_BLOCKS + 1` in private context
            effective_block: context.block_number().add(ShieldGatewayStorage::CHANGE_DELAY_BLOCKS.to_field() + 1),
        }
            .emit(encode_event(&mut context));
    }

    #[private]
    fn channel_exists(from: AztecAddress, to: AztecAddress, token: AztecAddress) -> bool {
        _channel_exists(&mut context, storage, from, to, token)
    }

    #[contract_library_method]
    fn _channel_exists(context: &mut PrivateContext, storage: Storage<&mut PrivateContext>, from: AztecAddress, to: AztecAddress, token: AztecAddress) -> bool {
        let key = _channel_key(from, to, token);
        ShieldGatewayStorage::at(storage.shield_gateway_storage.read()).is_channel_initialized(key).view(context)
    }

    #[private]
    fn initialize_channel(
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
        nonce: Field,
    ) {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let key = _channel_key(from, to, token);
        let _ = ShieldGatewayStorage::at(storage.shield_gateway_storage.read())
            .initialize_channel_balance(key, U253::zero(), from)
            .call(&mut context);

        // Publicly log new channel creation
        ShieldGateway::at(context.this_address())
            ._log_channel_creation(from, to, token)
            .enqueue(&mut context);
    }

    #[private]
    #[view]
    fn get_channel_balance(
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
    ) -> Field {
        _get_channel_balance(&mut context, storage, from, to, token).to_field()
    }

    #[private]
    fn channel_transfer(
        token: AztecAddress,
        from: AztecAddress,
        to: AztecAddress,
        amount: Field,
        nonce: Field,
    ) {
        let amount = U253::from_field(amount);
        let threshold = _get_channel_threshold_private(&mut context, storage, token);
        let current_balance = _get_channel_balance(&mut context, storage, from, to, token);

        let mut new_balance = current_balance + amount;
        // Check if the threshold is exceeded
        if new_balance > threshold {
            // Log the channel threshold exceeded
            ShieldGateway::at(context.this_address())
                ._log_channel_threshold_exceeded(from, to, token)
                .enqueue(&mut context);
            // Once the threshold is exceeded, reset the balance to 0
            new_balance = U253::zero();
        }

        // Update the channel balance
        let _ = _set_channel_balance(&mut context, storage, from, to, token, new_balance);

        // Finally, execute the transfer
        Token::at(token).transfer_private_to_private(from, to, amount.to_field(), nonce).call(&mut context);
    }

    #[private]
    fn verified_id_transfer(
        token: AztecAddress,
        from: AztecAddress,
        to: AztecAddress,
        amount: U253,
        nonce: Field,
    ) {
        aztec::oracle::debug_log::debug_log_format(
            "Checking transfer of {0} tokens from {1} to {2}",
            [amount.to_field(), from.to_field(), to.to_field()],
        );

        // TODO: What checks should we perform here?
        // Ensure Verified ID is provided & valid

        // Safety: pop_capsule will eventually be verified
        unsafe {
            let verified_id: [Field; 5] = pop_capsule();
            let _ = ShieldGateway::at(context.this_address()).verify_id_private(verified_id).view(
                &mut context,
            );
        }

        Token::at(token).transfer_private_to_private(from, to, amount.to_field(), nonce).call(
            &mut context,
        );
    }

    #[private]
    #[view]
    fn verify_id_private(verified_id: [Field; 5]) -> bool {
        // TODO: Implement ID verification logic
        aztec::oracle::debug_log::debug_log_format("Verified ID: {}", verified_id);
        true
    }

    #[public]
    #[internal]
    fn _log_channel_creation(from: AztecAddress, to: AztecAddress, token: AztecAddress) {
        ChannelCreation { from, to, token }.emit(encode_event(&mut context));
    }

    #[public]
    #[internal]
    fn _log_channel_threshold_exceeded(from: AztecAddress, to: AztecAddress, token: AztecAddress) {
        ChannelThresholdExceeded { from, to, token }.emit(encode_event(&mut context));
    }

    #[contract_library_method]
    fn _set_default_channel_threshold(context: &mut PublicContext, storage: Storage<&mut PublicContext>, new_threshold: Field) {
        storage.default_channel_threshold.schedule_value_change(U253::from_field(new_threshold));

        DefaultChannelThresholdChanged {
            new_threshold,
            // Change will be effective after `CHANGE_DELAY_BLOCKS` in public context and `CHANGE_DELAY_BLOCKS + 1` in private context
            effective_block: context.block_number().add(CHANGE_DELAY_BLOCKS.to_field() + 1),
        }
            .emit(encode_event(context));
    }



    #[contract_library_method]
    fn _get_channel_threshold_private(context: &mut PrivateContext, storage: Storage<&mut PrivateContext>, token: AztecAddress) -> U253 {
        let threshold = ShieldGatewayStorage::at(storage.shield_gateway_storage.read()).get_channel_threshold_private(token).view(context);

        if threshold.is_zero() {
            // If the threshold is not set for the token, use the default threshold
            storage.default_channel_threshold.get_current_value()
        } else {
            threshold
        }
    }

    #[contract_library_method]
    fn _channel_key(from: AztecAddress, to: AztecAddress, token: AztecAddress) -> Field {
        poseidon2_hash([from.to_field(), to.to_field(), token.to_field()])
    }

    #[contract_library_method]
    fn _get_channel_balance(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
    ) -> U253 {
        let key = _channel_key(from, to, token);
         ShieldGatewayStorage::at(storage.shield_gateway_storage.read())
            .get_channel_balance(key)
            .call(context)
    }

    #[contract_library_method]
    fn _set_channel_balance(
        context: &mut PrivateContext,
        storage: Storage<&mut PrivateContext>,
        from: AztecAddress,
        to: AztecAddress,
        token: AztecAddress,
        amount: U253,
    ) -> U253 {
        let key = _channel_key(from, to, token);
        ShieldGatewayStorage::at(storage.shield_gateway_storage.read())
            .set_channel_balance(key, amount, from)
            .call(context)
    }

    pub unconstrained fn get_storage_address() -> AztecAddress {
        storage.shield_gateway_storage.read()
    }

    pub unconstrained fn channel_key(from: AztecAddress, to: AztecAddress, token: AztecAddress) -> Field {
        _channel_key(from, to, token)
    }
}
