import { extract_file_id, get_destination_folder, timestamped_name } from "../../src/api/google/drive";

describe("drive helpers", () => {
    test("extract_file_id extracts ID from doc link", () => {
        const link = "https://docs.google.com/document/d/ABC123XYZ/edit";
        expect(extract_file_id(link)).toBe("ABC123XYZ");
    });

    test("extract_file_id throws on invalid link", () => {
        expect(() => extract_file_id("invalue")).toThrow();
    });

    test("timestamped_name includes base name", () => {
        const name = timestamped_name("Test Doc");
        expect(name).toContain("Test Doc");
    });

    test("get_destination_folder returns a folder ID", () => {
        expect(typeof get_destination_folder()).toBe("string");
    });
});