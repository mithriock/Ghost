import GhostLogo from '../../../../assets/images/orb-squircle.png';
import NiceModal, {useModal} from '@ebay/nice-modal-react';
import React, {useState} from 'react';
import useSettingGroup from '../../../../hooks/use-setting-group';
import {Button, Form, Heading, Modal, TextField, Toggle, showToast} from '@tryghost/admin-x-design-system';
import {JSONError} from '@tryghost/admin-x-framework/errors';
import {getSettingValues} from '@tryghost/admin-x-framework/api/settings';
import {useGlobalData} from '../../../providers/global-data-provider';
import {useHandleError} from '@tryghost/admin-x-framework/hooks';
import {useRouting} from '@tryghost/admin-x-framework/routing';

const MercadoPagoLogo: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="none" height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg">
        <rect fill="#009EE3" height="32" rx="6" width="32"/>
        <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14.4c-3.53 0-6.4-2.87-6.4-6.4S12.47 9.6 16 9.6s6.4 2.87 6.4 6.4-2.87 6.4-6.4 6.4z" fill="#fff"/>
        <path d="M16 11.2c-2.65 0-4.8 2.15-4.8 4.8s2.15 4.8 4.8 4.8 4.8-2.15 4.8-4.8-2.15-4.8-4.8-4.8zm0 8c-1.77 0-3.2-1.43-3.2-3.2s1.43-3.2 3.2-3.2 3.2 1.43 3.2 3.2-1.43 3.2-3.2 3.2z" fill="#fff"/>
    </svg>
);

const Start: React.FC<{onNext?: () => void}> = ({onNext}) => {
    return (
        <div>
            <div className='flex items-center justify-between'>
                <Heading level={3}>Conectar MercadoPago</Heading>
                <MercadoPagoLogo className='size-10' />
            </div>
            <div className='mt-6 mb-7'>
                MercadoPago es el procesador de pagos líder en Latinoamérica. Si aún no tienes una cuenta, puedes <a className='underline' href="https://www.mercadopago.com" rel="noopener noreferrer" target="_blank">registrarte aquí</a>.
            </div>
            <Button color='blue' label='Tengo una cuenta de MercadoPago →' onClick={onNext} />
        </div>
    );
};

const ConnectForm: React.FC<{onClose: () => void}> = ({onClose}) => {
    const {localSettings, updateSetting, handleSave, saveState} = useSettingGroup();
    const [accessToken, publicKey] = getSettingValues(localSettings, ['mercadopago_access_token', 'mercadopago_public_key']);
    const [testMode, setTestMode] = useState(false);
    const handleError = useHandleError();

    const onSubmit = async () => {
        try {
            showToast({title: 'Saving...', type: 'neutral'});
            await handleSave();
            showToast({title: 'MercadoPago connected', type: 'success'});
            onClose();
        } catch (e) {
            if (e instanceof JSONError) {
                showToast({
                    title: 'Failed to save settings',
                    type: 'error',
                    message: 'Check you copied both keys correctly'
                });
                return;
            }
            handleError(e);
        }
    };

    return (
        <div>
            <div className='mb-6 flex items-center justify-between'>
                <Heading level={3}>Connect with MercadoPago</Heading>
                <Toggle
                    direction='rtl'
                    label='Test mode'
                    labelClasses={`text-sm translate-y-[1px] ${testMode ? 'text-[#009EE3]' : 'text-grey-800'}`}
                    onChange={e => setTestMode(e.target.checked)}
                />
            </div>
            <div className='mb-4 rounded-sm border border-grey-200 bg-grey-50 p-4 text-sm text-grey-800 dark:border-grey-900 dark:bg-grey-950 dark:text-grey-400'>
                {testMode ? (
                    <p>Usa tus credenciales de <strong>TEST</strong> de MercadoPago. Encuéntralas en <a className='underline' href="https://www.mercadopago.com/developers/panel/app" rel="noopener noreferrer" target="_blank">tu panel de desarrollador</a> → Credenciales de prueba.</p>
                ) : (
                    <p>Usa tus credenciales de <strong>PRODUCCIÓN</strong> de MercadoPago. Encuéntralas en <a className='underline' href="https://www.mercadopago.com/developers/panel/app" rel="noopener noreferrer" target="_blank">tu panel de desarrollador</a> → Credenciales de producción.</p>
                )}
            </div>
            <Form marginBottom={false} marginTop>
                <TextField
                    hint='Tu Public Key de MercadoPago'
                    placeholder={testMode ? 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                    title='Public Key'
                    value={publicKey?.toString()}
                    onChange={e => updateSetting('mercadopago_public_key', e.target.value)}
                />
                <TextField
                    hint='Tu Access Token de MercadoPago'
                    placeholder={testMode ? 'TEST-xxxx-xxxx-xxxx-xxxx' : 'APP_USR-xxxx-xxxx-xxxx-xxxx'}
                    title='Access Token'
                    type='password'
                    value={accessToken?.toString()}
                    onChange={e => updateSetting('mercadopago_access_token', e.target.value)}
                />
                <Button className='mt-5' color='green' disabled={saveState === 'saving'} label='Save MercadoPago settings' onClick={onSubmit} />
            </Form>
        </div>
    );
};

const Connected: React.FC<{onClose?: () => void}> = ({onClose}) => {
    const {localSettings, updateSetting, handleSave} = useSettingGroup();
    const handleError = useHandleError();

    const onDisconnect = async () => {
        try {
            updateSetting('mercadopago_access_token', '');
            updateSetting('mercadopago_public_key', '');
            await handleSave();
            showToast({title: 'MercadoPago disconnected', type: 'success'});
            onClose?.();
        } catch (e) {
            handleError(e);
        }
    };

    const [publicKey] = getSettingValues(localSettings, ['mercadopago_public_key']);
    const isTestMode = publicKey?.toString().startsWith('TEST-');

    return (
        <section>
            <div className='flex items-center justify-between'>
                <Button color='red' icon='link-broken' iconColorClass='text-red' label='Disconnect' link onClick={onDisconnect} />
                <Button icon='close' iconColorClass='dark:text-white' label='Close' size='sm' hideLabel link onClick={onClose} />
            </div>
            <div className='my-20 flex flex-col items-center'>
                <div className='relative h-20 w-[200px]'>
                    <img alt='Ghost Logo' className='absolute left-10 size-16' src={GhostLogo} />
                    <div className='absolute right-10 flex size-16 items-center justify-center rounded-2xl bg-[#009EE3] shadow-[-1.5px_0_0_1.5px_#fff] dark:shadow-[-1.5px_0_0_1.5px_black]'>
                        <MercadoPagoLogo className='size-10' />
                    </div>
                </div>
                <Heading className='text-center' level={3}>
                    Connected with MercadoPago!{isTestMode ? ' (Test mode)' : ''}
                </Heading>
                <div className='mt-1 text-sm text-grey-700'>
                    Public Key: <code className='rounded bg-grey-100 px-1 py-0.5 text-xs dark:bg-grey-900'>{publicKey?.toString().substring(0, 20)}...</code>
                </div>
            </div>
        </section>
    );
};

const MercadoPagoConnectModal: React.FC = () => {
    const {settings} = useGlobalData();
    const [mercadopagoAccessToken] = getSettingValues(settings, ['mercadopago_access_token']);
    const {updateRoute} = useRouting();
    const [step, setStep] = useState<'start' | 'connect'>('start');
    const mainModal = useModal();

    const isConnected = Boolean(mercadopagoAccessToken);

    const close = () => {
        mainModal.remove();
        updateRoute('tiers');
    };

    let contents;
    if (isConnected) {
        contents = <Connected onClose={close} />;
    } else if (step === 'start') {
        contents = <Start onNext={() => setStep('connect')} />;
    } else {
        contents = <ConnectForm onClose={close} />;
    }

    return <Modal
        afterClose={() => {
            updateRoute('tiers');
        }}
        cancelLabel=''
        footer={<div className='mt-8'></div>}
        testId='mercadopago-modal'
        title=''
        width={isConnected ? 740 : 520}
        hideXOnMobile
    >
        {contents}
    </Modal>;
};

export default NiceModal.create(MercadoPagoConnectModal);
