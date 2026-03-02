import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';

export const STYLES = {
    success: chalk.green.bold,
    error: chalk.red.bold,
    warning: chalk.yellow.bold,
    info: chalk.cyan.bold,
    dim: chalk.dim,
    highlight: chalk.magenta.bold,
    address: chalk.gray,
};

export function printHeader() {
    // Using a smaller, cleaner font
    const logo = gradient.rainbow(figlet.textSync('FUTARCHY', {
        font: 'Small',  // Much smaller than 'ANSI Shadow'
    }));
    console.log(logo);
    console.log(chalk.dim('SDK v2 - Gnosis Chain\n'));
}

export function printSection(title, content, color = 'cyan') {
    console.log(boxen(content, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: color,
        title: title,
        titleAlignment: 'center'
    }));
}

export function printError(message) {
    console.log(boxen(chalk.red(message), {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'red',
        title: '❌ Error'
    }));
}
