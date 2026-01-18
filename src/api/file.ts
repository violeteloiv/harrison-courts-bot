import axios from "axios";
import { PassThrough } from "stream";

/**
 * Formats a date into UTC MM/DD/YY hh:mm UTC.
 * 
 * @param date The date object
 * @returns A string in the proper format 
 */
export function format_data_utc(date: Date): string {
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const yy = String(date.getUTCFullYear()).slice(-2);
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");

    return `${mm}/${dd}/${yy} ${hh}:${min} UTC`;
}

/**
 * Downloads an image file and gets the data in a buffer.
 * 
 * @param url The url of the image
 * @returns The buffer of image data
 */
export async function download_image(url: string): Promise<Buffer<any>> {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
}

/**
 * Translates a buffer into stream for applications which
 * require a stream over a buffer.
 * 
 * @param buffer The buffer for translation
 * @returns The resulting stream
 */
export function buffer_to_stream(buffer: Buffer): PassThrough {
    const stream = new PassThrough();
    stream.end(buffer);
    return stream;
}