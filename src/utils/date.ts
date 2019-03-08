import moment, { Moment } from "moment";

export function formatDateLong(stringDate: string): string {
    const date = moment(stringDate);
    return date.format("YYYY-MM-DD HH:mm:ss");
}

export function getDaysRange(startDate: Date | null, endDate: Date | null): Moment[] {
    if (!startDate || !endDate) {
        return [];
    } else {
        const startDateM = moment(startDate);
        const endDateM = moment(endDate);
        const currentDateM = startDateM.clone();
        let outputDates: Moment[] = [];

        while (currentDateM <= endDateM) {
            outputDates.push(currentDateM.clone());
            currentDateM.add(1, "days");
        }
        return outputDates;
    }
}
