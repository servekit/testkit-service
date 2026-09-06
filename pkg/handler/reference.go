// Reference-domain delegations: 1:1 forwards of reference.v1 types (the
// proto reuses the reference contract directly), so each method is one line.

package handler

import (
	"context"

	referencev1 "github.com/servekit/api/gen/go/reference/v1"
)

// ListCountries delegates to service.ListCountries.
func (h *Handler) ListCountries(ctx context.Context, req *referencev1.ListCountriesRequest) (*referencev1.ListCountriesResponse, error) {
	return h.svc.ListCountries(ctx, req)
}

// ListTimezones delegates to service.ListTimezones.
func (h *Handler) ListTimezones(ctx context.Context, req *referencev1.ListTimezonesRequest) (*referencev1.ListTimezonesResponse, error) {
	return h.svc.ListTimezones(ctx, req)
}

// ListLanguages delegates to service.ListLanguages.
func (h *Handler) ListLanguages(ctx context.Context, req *referencev1.ListLanguagesRequest) (*referencev1.ListLanguagesResponse, error) {
	return h.svc.ListLanguages(ctx, req)
}

// ListCurrencies delegates to service.ListCurrencies.
func (h *Handler) ListCurrencies(ctx context.Context, req *referencev1.ListCurrenciesRequest) (*referencev1.ListCurrenciesResponse, error) {
	return h.svc.ListCurrencies(ctx, req)
}

// ListRegionGroups delegates to service.ListRegionGroups.
func (h *Handler) ListRegionGroups(ctx context.Context, req *referencev1.ListRegionGroupsRequest) (*referencev1.ListRegionGroupsResponse, error) {
	return h.svc.ListRegionGroups(ctx, req)
}

// ParsePhone delegates to service.ParsePhone.
func (h *Handler) ParsePhone(ctx context.Context, req *referencev1.ParsePhoneRequest) (*referencev1.ParsePhoneResponse, error) {
	return h.svc.ParsePhone(ctx, req)
}

// ResolveCodes delegates to service.ResolveCodes.
func (h *Handler) ResolveCodes(ctx context.Context, req *referencev1.ResolveCodesRequest) (*referencev1.ResolveCodesResponse, error) {
	return h.svc.ResolveCodes(ctx, req)
}

// GetCountryProfile delegates to service.GetCountryProfile.
func (h *Handler) GetCountryProfile(ctx context.Context, req *referencev1.GetCountryProfileRequest) (*referencev1.GetCountryProfileResponse, error) {
	return h.svc.GetCountryProfile(ctx, req)
}
