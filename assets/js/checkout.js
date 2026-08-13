const VALID_FULFILLMENT_TYPES = new Set(['pickup', 'delivery']);

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

export function validateCheckoutDetails(details) {
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
    const validation = validateCheckoutDetails(details);

    if (!validation.isValid) {
        throw new TypeError('Os dados do checkout estão incompletos.');
    }

    const totals = getCheckoutTotals(details.fulfillmentType, productsTotal, deliveryFee);

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
    };
}
