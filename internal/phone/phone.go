// Package phone composes the BFF's form-shaped phone input — a dial code
// ("+86") plus a national number ("13800138000") — into the E.164 canonical
// form ("+8613800138000") the downstream services require. Deep validation
// (real number, real country) happens in user-service / message-service;
// this is a best-effort composition that returns "" for unusable input.
package phone

import "strings"

// ComposeE164 concatenates a validated dial code with the digits of the
// national number. Returns "" when either part is missing or the dial code
// does not start with "+".
func ComposeE164(dialCode, national string) string {
	dial := strings.TrimSpace(dialCode)
	if !strings.HasPrefix(dial, "+") || len(dial) < 2 {
		return ""
	}
	var b strings.Builder
	b.WriteString(dial)
	for _, r := range national {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) <= len(dial) {
		return ""
	}
	return s
}
