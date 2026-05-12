# Date And Time Format

`DATETIME_FORMAT` controls the date and time labels used by the HTML report. The default value is:

```bash
DATETIME_FORMAT=MMM D, h:mm AP
```

The formatter uses a small project-specific token set. Text that is not a token is printed as written.

## Tokens

| Token | Output                       | Example |
| ----- | ---------------------------- | ------- |
| `MMM` | Short month name             | `May`   |
| `D`   | Day of month                 | `9`     |
| `DD`  | Two-digit day of month       | `09`    |
| `H`   | 24-hour clock hour           | `5`     |
| `HH`  | Two-digit 24-hour clock hour | `05`    |
| `h`   | 12-hour clock hour           | `5`     |
| `hh`  | Two-digit 12-hour clock hour | `05`    |
| `mm`  | Two-digit minutes            | `07`    |
| `ss`  | Two-digit seconds            | `04`    |
| `AP`  | Uppercase meridiem           | `AM`    |
| `A`   | Uppercase meridiem           | `AM`    |
| `a`   | Lowercase meridiem           | `am`    |

`H` and `HH` are always 24-hour clock tokens. `h` and `hh` are always 12-hour clock tokens. The meridiem tokens `AP`, `A`, and `a` only print meridiem text and do not change how hour tokens behave.

There is no single-second token. Use `ss` for zero-filled seconds.

## Examples

```bash
DATETIME_FORMAT=MMM D, h:mm AP
```

Example output: `May 9, 5:07 PM`

```bash
DATETIME_FORMAT=MMM D, h:mm:ss AP
```

Example output: `May 9, 5:07:04 PM`

```bash
DATETIME_FORMAT=MMM DD, HH:mm:ss
```

Example output: `May 09, 17:07:04`
