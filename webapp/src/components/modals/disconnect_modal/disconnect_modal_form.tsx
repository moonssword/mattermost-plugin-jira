// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {Modal} from 'react-bootstrap';

import {Instance, ReactSelectOption} from 'types/model';

import {getModalStyles} from 'utils/styles';

import FormButton from 'components/form_button';
import ReactSelectSetting from 'components/react_select_setting';

import {tr} from 'utils/i18n';

import {Props} from './props';
export type State = {
    submitting: boolean;
    error: string;
    selectedInstance: string;
};

export default class DisconnectModalForm extends PureComponent<Props, State> {
    state = {
        submitting: false,
        error: '',
        selectedInstance: '',
    };

    submit = async (e: React.FormEvent<HTMLFormElement>) => {
        if (e.preventDefault) {
            e.preventDefault();
        }

        const selectedInstance = this.state.selectedInstance;
        if (!selectedInstance) {
            this.setState({error: tr('Выберите инстанс Jira')});
            return;
        }

        this.props.disconnectUser(selectedInstance).then(({error}) => {
            if (error) {
                this.setState({error: error.toString()});
            } else {
                this.props.sendEphemeralPost(tr('Вы отключены от инстанса Jira {instance}', {instance: selectedInstance}));
                this.props.closeModal();
            }
        });
    };

    closeModal = (e: React.FormEvent<HTMLFormElement>) => {
        this.props.closeModal();
    };

    handleInstanceChoice = (_: string, instanceID: string) => {
        if (instanceID === this.state.selectedInstance) {
            return;
        }

        this.setState({selectedInstance: instanceID, error: ''});
    };

    render(): JSX.Element {
        const style = getModalStyles(this.props.theme);

        const options: ReactSelectOption[] = this.props.connectedInstances.map((instance: Instance) => (
            {label: instance.instance_id, value: instance.instance_id}
        ));
        const instanceSelector = (
            <ReactSelectSetting
                options={options}
                theme={this.props.theme}
                onChange={this.handleInstanceChoice}
                value={options.find((opt) => opt.value === this.state.selectedInstance)}
            />
        );

        const footer = (
            <React.Fragment>
                <FormButton
                    type='button'
                    btnClass='btn-link'
                    defaultMessage={tr('Отмена')}
                    onClick={this.closeModal}
                />
                <FormButton
                    type='submit'
                    btnClass='btn btn-primary'
                    defaultMessage={tr('Отключить')}
                    disabled={!this.state.selectedInstance}
                    saving={this.state.submitting}
                />
                <p className={'error-text'}>
                    {this.state.error}
                </p>
            </React.Fragment>
        );

        return (
            <form
                role='form'
                onSubmit={this.submit}
            >
                <Modal.Body
                    style={style.modalBody}
                >
                    {instanceSelector}
                </Modal.Body>
                <Modal.Footer style={style.modalFooter}>
                    {footer}
                </Modal.Footer>
            </form>
        );
    }
}
