export const business = {
    name: 'Espaço Delícia',
    phone: '(14) 99798-0908',
    whatsapp: '5514997980908',
    address: 'Rua 15 de Novembro, 787. Centro, Timburi/SP.',
    openingHours: [
        { day: 'Segunda-feira', hours: 'Fechado' },
        { day: 'Terça-feira', hours: 'Fechado' },
        { day: 'Quarta-feira', hours: '14:00 às 20:00' },
        { day: 'Quinta-feira', hours: '14:00 às 20:00' },
        { day: 'Sexta-feira', hours: '14:00 às 21:00' },
        { day: 'Sábado', hours: '11:00 às 21:00' },
        { day: 'Domingo', hours: '11:00 às 18:00' },
    ],
    deliveryFee: 0,
};

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

const businessDayIndexes = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
};

export function isBusinessOpen(date, businessData = business) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        return false;
    }

    const dateTimeParts = Object.fromEntries(
        businessDateTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
    );
    const businessHours = businessData.openingHours[businessDayIndexes[dateTimeParts.weekday]]?.hours;

    if (businessHours === 'Fechado') {
        return false;
    }

    const hoursMatch = /^(\d{2}):(\d{2}) às (\d{2}):(\d{2})$/.exec(businessHours ?? '');

    if (!hoursMatch) {
        return false;
    }

    const currentTimeInSeconds =
        Number(dateTimeParts.hour) * 3600 +
        Number(dateTimeParts.minute) * 60 +
        Number(dateTimeParts.second);
    const openingTimeInSeconds = Number(hoursMatch[1]) * 3600 + Number(hoursMatch[2]) * 60;
    const closingTimeInSeconds = Number(hoursMatch[3]) * 3600 + Number(hoursMatch[4]) * 60;

    return currentTimeInSeconds >= openingTimeInSeconds && currentTimeInSeconds < closingTimeInSeconds;
}
