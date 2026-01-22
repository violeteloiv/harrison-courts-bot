export function get_caller_info(error: Error, depth = 2) {
    const stack = error.stack;
    if (!stack) return {};

    const lines = stack.split("\n");
    const target = lines[depth];
    if (!target) return {};

    const match = target.match(/\s*at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
    if (!match) return {};

    return {
        function: match[1],
        file: match[2],
        line: Number(match[3]),
        column: Number(match[4]),
    };
}

export function format_error_info(error: Error) {
    let info = get_caller_info(error);
    return `${error.message} at\n${info.file} | line ${info.line} | function ${info.function}`;
}