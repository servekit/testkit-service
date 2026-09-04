// Package option defines functional options for embedding testkit-service.
//
// testkit is a terminal aggregator: it embeds its downstreams itself and has
// no injectable heavy resources, so the Options struct starts empty. If a
// resource that benefits from caller injection ever appears (a parent sharing
// its db/redis), the WithXxx accessor lands here without breaking callers.
package option

// Option mutates Options.
type Option func(*Options)

// Options holds resolved dependencies for module construction.
type Options struct{}

// Apply evaluates all options and returns the resolved Options.
func Apply(opts ...Option) Options {
	var o Options
	for _, opt := range opts {
		opt(&o)
	}
	return o
}
