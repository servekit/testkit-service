// Package reference is testkit's reference-domain forwarder. The RPCs are
// 1:1 forwards of the reference.v1 contract — testkit's proto reuses the
// reference.v1 request/response types directly (no mirrored DTOs), so every
// method here is a pure pass-through to the embedded reference-service
// handler (module mode) or client (grpc mode).
package reference

import (
	"context"

	referencev1 "github.com/servekit/api/gen/go/reference/v1"
	referenceservice "github.com/servekit/reference-service/pkg"
)

// Service forwards reference RPCs to the reference backend.
type Service struct {
	ref referenceservice.Service
}

// New constructs the reference-domain forwarder.
func New(ref referenceservice.Service) *Service {
	return &Service{ref: ref}
}

// ListCountries returns the country directory in the request locale.
func (s *Service) ListCountries(ctx context.Context, req *referencev1.ListCountriesRequest) (*referencev1.ListCountriesResponse, error) {
	return s.ref.ListCountries(ctx, req)
}

// ListTimezones returns the IANA timezone directory in the request locale.
func (s *Service) ListTimezones(ctx context.Context, req *referencev1.ListTimezonesRequest) (*referencev1.ListTimezonesResponse, error) {
	return s.ref.ListTimezones(ctx, req)
}

// ListLanguages returns the BCP 47 language directory in the request locale.
func (s *Service) ListLanguages(ctx context.Context, req *referencev1.ListLanguagesRequest) (*referencev1.ListLanguagesResponse, error) {
	return s.ref.ListLanguages(ctx, req)
}

// ListCurrencies returns the ISO 4217 directory in the request locale.
func (s *Service) ListCurrencies(ctx context.Context, req *referencev1.ListCurrenciesRequest) (*referencev1.ListCurrenciesResponse, error) {
	return s.ref.ListCurrencies(ctx, req)
}

// ListRegionGroups returns the UN M49 hierarchy in the request locale.
func (s *Service) ListRegionGroups(ctx context.Context, req *referencev1.ListRegionGroupsRequest) (*referencev1.ListRegionGroupsResponse, error) {
	return s.ref.ListRegionGroups(ctx, req)
}

// ParsePhone applies libphonenumber rules to raw input.
func (s *Service) ParsePhone(ctx context.Context, req *referencev1.ParsePhoneRequest) (*referencev1.ParsePhoneResponse, error) {
	return s.ref.ParsePhone(ctx, req)
}

// ResolveCodes batch-resolves codes across domains with alias normalization.
func (s *Service) ResolveCodes(ctx context.Context, req *referencev1.ResolveCodesRequest) (*referencev1.ResolveCodesResponse, error) {
	return s.ref.ResolveCodes(ctx, req)
}

// GetCountryProfile aggregates the domains for one country.
func (s *Service) GetCountryProfile(ctx context.Context, req *referencev1.GetCountryProfileRequest) (*referencev1.GetCountryProfileResponse, error) {
	return s.ref.GetCountryProfile(ctx, req)
}

// ListCountriesByRegion forwards to the reference backend.
func (s *Service) ListCountriesByRegion(ctx context.Context, req *referencev1.ListCountriesByRegionRequest) (*referencev1.ListCountriesByRegionResponse, error) {
	return s.ref.ListCountriesByRegion(ctx, req)
}

// GetCountryDefaults forwards to the reference backend.
func (s *Service) GetCountryDefaults(ctx context.Context, req *referencev1.GetCountryDefaultsRequest) (*referencev1.GetCountryDefaultsResponse, error) {
	return s.ref.GetCountryDefaults(ctx, req)
}

// GetDataInfo forwards to the reference backend.
func (s *Service) GetDataInfo(ctx context.Context, req *referencev1.GetDataInfoRequest) (*referencev1.GetDataInfoResponse, error) {
	return s.ref.GetDataInfo(ctx, req)
}
