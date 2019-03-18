import moment, { Moment } from "moment";

export function formatDateLong(stringDate: string): string {
    const date = moment(stringDate);
    return date.format("YYYY-MM-DD HH:mm:ss");
}

export function getDaysRange(startDate: Moment | null, endDate: Moment | null): Moment[] {
    if (!startDate || !endDate) {
        return [];
    } else {
        const currentDate = startDate.clone();
        let outputDates: Moment[] = [];

        while (currentDate <= endDate) {
            outputDates.push(currentDate.clone());
            currentDate.add(1, "days");
        }
        return outputDates;
    }
}
