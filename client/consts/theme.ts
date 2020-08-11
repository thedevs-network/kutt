const merge = require('deepmerge')

const dark = {
    text: {
        main: '#EEEEEE',
        primary: '#FFFFFF',
        secondary: '#FFFFFF',
        warning: '#FFFFFF',
        error: 'red',
        default: '#FFFFFF',
        links: '#92c6f0',
        accent: '#BBBBBB',
        disabled: 'b5b5b5',
        placeholder: '#DDDDDD',
        extensions: '#FFFFFF'
    },
    background: {
        main: '#555555',
        primary: '#2196F3',
        secondary: '#702CD6',
        warning: '#ee3b3b',
        default: '#bdbdbd',
        accent: '#999999',
        disabled: '#888888',
        extensions: '#777777',
        features: '#444444',
        footer: '#999999'
    },
    component: {
        spinner: 'hsl(200, 15%, 70%)',
        divider: 'hsl(200, 20%, 92%)',

    },
    stats: {
        map0: 'hsl(200, 15%, 92%)',
        map06: 'hsl(261, 46%, 68%)',
        map05: 'hsl(261, 46%, 72%)',
        map04: 'hsl(261, 46%, 76%)',
        map03: 'hsl(261, 46%, 82%)',
        map02: 'hsl(261, 46%, 86%)',
        map01: 'hsl(261, 46%, 90%)',
        lastUpdateText: 'hsl(200, 14%, 60%)',
        totalUnderline: 'hsl(200, 35%, 65%)'
    },
    icon: {
        default: {
            main: 'hsl(200, 35%, 45%)',
            shadow: 'hsla(200, 15%, 60%, 0.12)'
        },
        check: {
            main: 'hsl(144, 50%, 60%)'
        },
        copy: {
            main: 'hsl(144, 100%, 35%)',
            bg: 'hsl(144, 10%, 30%)'
        },
        edit: {
            main: 'hsl(46, 100%, 40%)',
            bg: 'hsl(46, 10%, 30%)'
        },
        pie: {
            main: 'hsl(260, 100%, 69%)',
            bg: 'hsl(260, 10%, 30%)'
        },
        qrCode: {
            main: 'hsl(110, 100%, 100%)',
            bg: 'hsl(0, 10%, 30%)'
        },
        stop: {
            main: 'hsl(10, 100%, 40%)',
            bg: 'hsl(10, 10%, 30%)'
        },
        trash: {
            main: 'hsl(0, 70%, 60%)',
            bg: 'hsl(0,  10%, 30%)',
            disabled: '#c7c7c7'
        },
        eye: {
            main: 'hsl(100, 100%, 100%)',
            bg: 'hsl(0,  10%, 30%)'
        },
        send: {
            main: '#aaaaaa'
        },
        chrome: {
            main: "#4285f4"
        },
        firefox: {
            main: "#e0890f"
        },
        feature: {
            main: "#FFFFFF"
        }
    },
    table: {
        border: '#888888',
        headBg: '#444444',
        headBorder: '#777777',
        rowHover: '#777777',
        row: '#666666',
        shadow: '#444444'
    }
};
const light = {
    text: {
        main: "hsl(200, 35%, 25%)",
        primary: '#FFFFFF',
        secondary: '#FFFFFF',
        warning: '#FFFFFF',
        default: '#444',
        error: 'red',
        placeholder: '#888888',
        links: '#2196F3',
        accent: 'hsl(200, 35%, 25%)',
        disabled: 'b5b5b5',
        extensions: '#FFFFFF'
    },
    background: {
        main: 'hsl(206, 12%, 95%)',
        primary: '#2196F3',
        secondary: '#702CD6',
        warning: '#ee3b3b',
        default: '#e0e0e0',
        accent: '#FFFFFF',
        disabled: '#f6f6f6',
        extensions: 'hsl(230, 15%, 20%)',
        features: 'hsl(230, 15%, 92%)',
        footer: '#FFFFFF'
    },
    component: {
        spinner: 'hsl(200, 15%, 70%)',
        divider: 'hsl(200, 20%, 92%)',

    },
    stats: {
        map0: 'hsl(200, 15%, 92%)',
        map06: 'hsl(261, 46%, 68%)',
        map05: 'hsl(261, 46%, 72%)',
        map04: 'hsl(261, 46%, 76%)',
        map03: 'hsl(261, 46%, 82%)',
        map02: 'hsl(261, 46%, 86%)',
        map01: 'hsl(261, 46%, 90%)',
        lastUpdateText: 'hsl(200, 14%, 60%)',
        totalUnderline: 'hsl(200, 35%, 65%)'
    },
    icon: {
        default: {
            main: 'hsl(200, 35%, 45%)',
            shadow: 'hsla(200, 15%, 60%, 0.12)'
        },
        activate: {
            main: 'hsl(0, 0%, 73%)',
            bg: 'transparent'
        },
        check: {
            main: 'hsl(144, 50%, 60%)'
        },
        copy: {
            main: 'hsl(144, 40%, 57%)',
            bg: 'hsl(144, 100%, 96%)'
        },
        edit: {
            main: 'hsl(46, 90%, 50%)',
            bg: 'hsl(46, 100%, 94%)'
        },
        pie: {
            main: 'hsl(260, 100%, 69%)',
            bg: 'hsl(260, 100%, 96%)'
        },
        qrCode: {
            main: 'hsl(0, 0%, 35%)',
            bg: 'hsl(0, 0%, 94%)'
        },
        stop: {
            main: 'hsl(10, 100%, 40%)',
            bg: 'hsl(10, 100%, 96%)'
        },
        trash: {
            main: 'hsl(0, 100%, 69%)',
            bg: 'hsl(0, 100%, 96%)',
            disabled: '#c7c7c7'
        },
        send: {
            main: '#aaaaaa'
        },
        chrome: {
            main: "#4285f4"
        },
        firefox: {
            main: "#e0890f"
        },
        feature: {
            main: "#FFFFFF"
        }
    },
    table: {
        border: 'hsl(200, 14%, 90%)',
        headBg: 'hsl(200, 12%, 95%)',
        headBorder: 'hsl(200, 14%, 94%)',
        rowHover: 'hsl(200, 14%, 98%)',
        row: '#FFFFFF',
        shadow: 'hsla(200, 20%, 70%, 0.3)',
        edit:'#FAFAFA'
    }
}
let lightTempo = light;
let darkTempo = dark;
try {
    var { customLight, customDark } = require("../../customTheme");
    lightTempo = merge(light, customLight);
    darkTempo = merge(dark, customDark);
} catch (ex) {
}

export type Colors = "primary" | "secondary" | "warning" | "default"

export const theme = lightTempo;
export const darkTheme = darkTempo;
