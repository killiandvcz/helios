export class PrettyDebug {
    constructor(namespace = 'app', customLevels = {}) {
        this.namespace = namespace;
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            black: '\x1b[30m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            gray: '\x1b[90m'
        };

        // Niveaux de base par défaut
        this.defaultLevels = {
            info: {
                emoji: '📝',
                color: this.colors.blue,
                label: 'INFO'
            },
            success: {
                emoji: '✅',
                color: this.colors.green,
                label: 'SUCCESS'
            },
            warning: {
                emoji: '⚠️',
                color: this.colors.yellow,
                label: 'WARNING'
            },
            error: {
                emoji: '❌',
                color: this.colors.red,
                label: 'ERROR'
            },
            debug: {
                emoji: '🔍',
                color: this.colors.magenta,
                label: 'DEBUG'
            }
        };

        // Fusionner les niveaux par défaut avec les niveaux personnalisés
        this.levels = { ...this.defaultLevels, ...customLevels };

        // Créer dynamiquement les méthodes pour chaque niveau
        this._createLogMethods();
    }

    _createLogMethods() {
        Object.keys(this.levels).forEach(level => {
            this[level] = (message, data = null) => {
                this._log(level, message, data);
            };
        });
    }

    _formatTime() {
        const now = new Date();
        return now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            millisecond: true
        });
    }

    _formatValue(value) {
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return value;
    }

    _log(level, message, data = null) {
        const levelConfig = this.levels[level];
        if (!levelConfig) {
            console.warn(`Unknown log level: ${level}`);
            return;
        }

        const { emoji, color, label } = levelConfig;
        const time = this._formatTime();
        const reset = this.colors.reset;
        const bright = this.colors.bright;
        const dim = this.colors.dim;

        console.log(
            `${color}${bright}${emoji} [${time}][${this.namespace}][${label}]${reset} ${message}`
        );

        if (data !== null) {
            if (typeof data === 'object' && data instanceof Error) {
                console.log(
                    `${color}${dim}↳ Error: ${reset}${data.message}\n${dim}${data.stack}${reset}`
                );
            } else {
                console.log(
                    `${color}${dim}↳ Data: ${reset}${this._formatValue(data)}`
                );
            }
        }
    }

    // Utilitaires de mesure de performance
    measure(label, callback) {
        const start = performance.now();
        const result = callback();
        const duration = (performance.now() - start).toFixed(2);

        // Utilise le niveau 'perf' s'il existe, sinon utilise 'info'
        const method = this.levels.perf ? 'perf' : 'info';
        this[method](`${label} completed in ${duration}ms`);
        return result;
    }

    async measureAsync(label, callback) {
        const start = performance.now();
        const result = await callback();
        const duration = (performance.now() - start).toFixed(2);

        const method = this.levels.perf ? 'perf' : 'info';
        this[method](`${label} completed in ${duration}ms`);
        return result;
    }

    // Méthode pour ajouter ou mettre à jour un niveau personnalisé
    addLevel(name, config) {
        this.levels[name] = config;
        this._createLogMethods();
    }
}

export const heliosDebug = () => new PrettyDebug('helios', {
    connection: {
        emoji: '🔌',
        color: '\x1b[36m',
        label: 'CONNECT'
    },
    disconnection: {
        emoji: '🔌',
        color: '\x1b[31m',
        label: 'DISCONNECT'
    },
    request: {
        emoji: '📡',
        color: '\x1b[35m',
        label: 'REQUEST'
    },
    message: {
        emoji: '📩',
        color: '\x1b[32m',
        label: 'MESSAGE'
    },
    notification: {
        emoji: '🔔',
        color: '\x1b[33m',
        label: 'NOTIFICATION'
    }
})