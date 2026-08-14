const VALID_FULFILLMENT_TYPES = new Set(['pickup', 'delivery']);
const VALID_PAYMENT_METHODS = new Set(['pix', 'card', 'cash']);

function normalizePhone(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function assertMoney(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`${label} deve ser um inteiro seguro não negativo.`);
    }
}

export function formatPhone(value) {
    const digits = normalizePhone(value);

    if (digits.length === 0) {
        return '';
    }

    if (digits.length <= 2) {
        return `(${digits}`;
    }

    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function parseCurrencyToCents(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const match = value.trim().match(/^(?:R\$\s*)?(\d+)(?:[,.](\d{0,2}))?$/i);

    if (!match) {
        return null;
    }

    const fraction = (match[2] ?? '').padEnd(2, '0');
    const cents = BigInt(match[1]) * 100n + BigInt(fraction || '0');

    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
        return null;
    }

    return Number(cents);
}

export function validateCheckoutDetails(details, productsTotal, deliveryFee) {
    const errors = {};
    const fulfillmentType = details?.fulfillmentType;

    if (!VALID_FULFILLMENT_TYPES.has(fulfillmentType)) {
        errors.fulfillmentType = 'Escolha entre Retirada e Delivery.';
    }

    if (!normalizeText(details?.fullName)) {
        errors.fullName = 'Informe seu nome.';
    }

    if (normalizePhone(details?.phone).length !== 11) {
        errors.phone = 'Informe um telefone válido.';
    }

    if (fulfillmentType === 'delivery') {
        if (!normalizeText(details?.street)) {
            errors.street = 'Informe o endereço.';
        }

        if (!normalizeText(details?.number)) {
            errors.number = 'Informe o número.';
        }

        if (!normalizeText(details?.neighborhood)) {
            errors.neighborhood = 'Informe o bairro.';
        }
    }

    const paymentMethod = details?.paymentMethod;

    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
        errors.paymentMethod = 'Escolha uma forma de pagamento.';
    } else if (paymentMethod === 'cash') {
        if (typeof details?.needsChange !== 'boolean') {
            errors.needsChange = 'Informe se precisa de troco.';
        } else if (details.needsChange) {
            const changeFor = parseCurrencyToCents(details.changeFor);

            if (changeFor === null || changeFor <= 0) {
                errors.changeFor = 'Informe um valor válido para o troco.';
            } else {
                const totals = getCheckoutTotals(fulfillmentType, productsTotal, deliveryFee);

                if (changeFor < totals.total) {
                    errors.changeFor = 'O valor para troco deve ser maior que o total do pedido.';
                } else if (changeFor === totals.total) {
                    errors.changeFor =
                        'Esse valor é igual ao total. Nesse caso, não é necessário troco.';
                }
            }
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

export function getCheckoutTotals(fulfillmentType, productsTotal, deliveryFee) {
    assertMoney(productsTotal, 'productsTotal');
    assertMoney(deliveryFee, 'deliveryFee');

    const deliveryFeeApplied = fulfillmentType === 'delivery' ? deliveryFee : 0;
    const total = productsTotal + deliveryFeeApplied;

    if (!Number.isSafeInteger(total)) {
        throw new RangeError('O total preliminar excede o limite seguro.');
    }

    return {
        deliveryFee: deliveryFeeApplied,
        total,
    };
}

export function buildCheckoutDetails(details, productsTotal, deliveryFee) {
    const validation = validateCheckoutDetails(details, productsTotal, deliveryFee);

    if (!validation.isValid) {
        throw new TypeError('Os dados do checkout estão incompletos.');
    }

    const totals = getCheckoutTotals(details.fulfillmentType, productsTotal, deliveryFee);
    const needsChange = details.paymentMethod === 'cash' && details.needsChange === true;
    const changeFor = needsChange ? parseCurrencyToCents(details.changeFor) : null;
    const changeAmount = needsChange ? changeFor - totals.total : 0;

    return {
        fulfillmentType: details.fulfillmentType,
        customer: {
            fullName: normalizeText(details.fullName),
            phone: normalizePhone(details.phone),
        },
        delivery:
            details.fulfillmentType === 'delivery'
                ? {
                      street: normalizeText(details.street),
                      number: normalizeText(details.number),
                      neighborhood: normalizeText(details.neighborhood),
                      complement: normalizeText(details.complement),
                  }
                : null,
        productsTotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        payment: {
            method: details.paymentMethod,
            needsChange,
            changeFor,
            changeAmount,
        },
    };
}
