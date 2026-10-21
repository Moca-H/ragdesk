import { createTheme, type MantineColorsTuple } from '@mantine/core'

const brass: MantineColorsTuple = [
  '#faf4ea',
  '#efe2cc',
  '#e7d4b4',
  '#d4b37a',
  '#c49a5f',
  '#b08d57',
  '#8b6a3a',
  '#6f532c',
  '#574124',
  '#3d2d18',
]

export const ragdeskTheme = createTheme({
  primaryColor: 'brass',
  colors: { brass },
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  headings: {
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
  },
  defaultRadius: 6,
  cursorType: 'pointer',
  components: {
    Select: {
      defaultProps: {
        allowDeselect: false,
        withCheckIcon: true,
        checkIconPosition: 'right',
        comboboxProps: {
          transitionProps: { transition: 'pop', duration: 160 },
          shadow: 'md',
          offset: 6,
        },
      },
    },
  },
})
