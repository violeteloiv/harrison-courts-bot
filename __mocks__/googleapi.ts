const mock_drive = {
    files: {
        copy: jest.fn(),
        export: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
    },
    permissions: {
        create: jest.fn(),
    },
};

export const google = {
    drive: jest.fn(() => mock_drive ),
};

export { mock_drive };