# truelist-n8n

[![npm version](https://img.shields.io/npm/v/truelist-n8n?style=flat-square)](https://www.npmjs.com/package/truelist-n8n)
[![Free tier](https://img.shields.io/badge/free_plan-100_validations-4A7C59?style=flat-square)](https://truelist.io/pricing)

n8n community node for [Truelist](https://truelist.io) email validation. Validate email addresses directly from your n8n workflows.

> **Start free** — 100 validations + 10 enhanced credits, no credit card required.
> [Get your API key →](https://app.truelist.io/signup?utm_source=github&utm_medium=readme&utm_campaign=free-plan&utm_content=truelist-n8n)

## Installation

In your n8n instance, go to **Settings > Community Nodes** and install:

```
truelist-n8n
```

## Configuration

1. Add a **Truelist API** credential in n8n
2. Paste your API key (get one at [app.truelist.io](https://app.truelist.io/signup?utm_source=github&utm_medium=readme&utm_campaign=free-plan&utm_content=truelist-n8n))
3. Use the **Truelist** node in your workflows

---

## Operations

### Email Resource

#### Validate

Validate a single email address synchronously and get an immediate result.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Email Address | Yes | The email address to validate |

**Output:** A single object with the validation result, including `email_state` (`ok`, `invalid`, `risky`, `unknown`) and `email_sub_state`.

---

#### List

List previously validated email addresses stored in your Truelist account.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Return All | No | Return all records (ignores Limit) |
| Limit | No | Max results to return (1–100, default 50) |
| Filters → Email State | No | Filter by: All, OK, Invalid, Risky, Unknown |
| Filters → Email Sub-State | No | Filter by sub-state (disposable, role, no mailbox, etc.) |
| Filters → Email Address | No | Search by a specific email address |
| Filters → Batch ID | No | Filter to emails from a specific batch |

---

### Batch Resource

#### Create

Upload a list of emails for bulk validation.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Emails | Yes | Comma-separated list, newline-separated, or a JSON array via expression |
| Filename | No | Label for this batch (default: `data.csv`) |
| Validation Strategy | No | `fast`, `accurate` (default), or `enhanced` — see [Validation Strategies](#validation-strategies) |
| Webhook URL | No | URL to call when the batch finishes processing |

**Output:** Batch object including `id`, `status`, and progress fields.

> **Note:** Batches start automatically within a few seconds — no separate "start" step is needed.

---

#### Get

Fetch the current status and details of a batch.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Batch ID | Yes | The UUID of the batch |

---

#### List

List all batches on your account.

---

#### Estimate

Estimate the credit cost and processing time for a list of emails before creating a batch. Useful for checking you have enough credits before kicking off a large run.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Emails | Yes | Comma-separated list or JSON array |

---

#### Download

Download validated batch results as a CSV file. The output item includes the CSV as binary data attached under the `data` key.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Batch ID | Yes | The UUID of the batch |
| Result Type | Yes | Which result set to download (see below) |

**Result types:**

| Value | Description |
|-------|-------------|
| Annotated | All emails with validation results appended as extra columns |
| Safest Bet | Only emails confirmed as valid — most conservative send list |
| Highest Reach | Valid emails plus accept-all domains — most inclusive send list |
| Only Invalid | Only emails that failed validation |

---

#### Delete

Permanently delete a batch and its results.

**Inputs:**

| Field | Required | Description |
|-------|----------|-------------|
| Batch ID | Yes | The UUID of the batch to delete |

---

## Validation Results

| State | Sub-state | Meaning |
|-------|-----------|---------|
| `ok` | `email_ok` | Valid, deliverable email address |
| `ok` | `accept_all` | Domain accepts all mail — individual deliverability unverified |
| `risky` | `is_disposable` | Temporary or disposable email address |
| `risky` | `is_role` | Role address (e.g. `info@`, `support@`, `admin@`) |
| `invalid` | `failed_syntax_check` | Invalid email format |
| `invalid` | `failed_mx_check` | Domain has no valid mail server |
| `invalid` | `failed_smtp_check` | SMTP server rejected the address |
| `invalid` | `failed_no_mailbox` | Mailbox does not exist |
| `invalid` | `failed_greylisted` | Server greylisted the check; could not confirm |
| `unknown` | — | Validity could not be determined |

---

## Validation Strategies

| Strategy | Description | Cost |
|----------|-------------|------|
| Fast | SMTP check only — fastest option | 1 credit per email |
| Accurate *(default)* | SMTP check with improved accuracy | 1 credit per email |
| Enhanced | SMTP + HaveIBeenPwned lookup + browser-based validation | 1 standard + 1 enhanced credit |

---

## Example Workflows

### Validate a single email and branch on result

1. Add a **Truelist** node
2. Set **Resource** → `Email`, **Operation** → `Validate`
3. Set **Email Address** to `{{ $json.email }}`
4. Add an **IF** node after it: check `{{ $json.email_state }} === "ok"`

### Bulk validate a list and download clean results

1. **Truelist** → Resource: `Batch`, Operation: `Estimate` — confirm you have enough credits
2. **Truelist** → Resource: `Batch`, Operation: `Create` — pass your email list
3. **Loop / Wait** until `status` is `completed` (poll with **Truelist** → `Batch: Get`)
4. **Truelist** → Resource: `Batch`, Operation: `Download`, Result Type: `Safest Bet`
5. Write the binary CSV to disk or pass it downstream

---

## Resources

- [Truelist website](https://truelist.io)
- [API documentation](https://apidocs.truelist.io)
- [Verification result codes](https://truelist.io/docs/usage/result-codes)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/)
- [Support](mailto:hello@truelist.io)

## License

MIT
