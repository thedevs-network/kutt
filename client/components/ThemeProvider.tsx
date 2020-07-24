 
import React, { useState, useCallback, useContext } from 'react'
import cookie from "js-cookie";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { darkTheme, theme } from '../consts/theme'

const context = React.createContext(null)

export const useToggleDarkMode = () : [Boolean, () => void ]=> {
    const toggle = useContext(context)
    return toggle
}
const toggle = () => console.log('test')

export default function ThemeProvider({
    defaultValue = false,//Cookies.get('darkModeEnabled'),
    children
}) {
    const [darkModeEnabled, setDarkModeEnabled] = useState(defaultValue);//Cookies.get('darkModeEnabled'))
    const toggleDarkMode = useCallback(() => {
        setDarkModeEnabled(value => !value)
        cookie.set("darkModeEnabled", !darkModeEnabled, { expires: 365 });
    }, [setDarkModeEnabled, darkModeEnabled])
    return (
        <StyledThemeProvider theme={darkModeEnabled ? darkTheme : theme}>
            <context.Provider value={[darkModeEnabled,toggleDarkMode]}>
                {children}
            </context.Provider>
        </StyledThemeProvider>
    )
}