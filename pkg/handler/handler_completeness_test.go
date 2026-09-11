// Completeness guard (fix-wave 2, finding A): every RPC declared by the
// testkit proto must have a live Handler method. The embedded
// UnimplementedTestkitServiceServer satisfies the server interface for any
// missing method, so a proto rename that misses the wiring compiles clean
// and 501s at runtime (phase ④ T6: ListPolicies dropped its Message*
// prefix in the proto but kept it here; GetCountries was never wired).
// Reflection cannot tell a real override from the compiler-generated
// promotion thunk (both surface as (*Handler).Name), so this walks the
// package source for methods declared with a Handler receiver.
package handler_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"

	"github.com/stretchr/testify/require"
)

// handlerMethods parses this package's non-test sources and returns the
// method names declared with a Handler receiver.
func handlerMethods(t *testing.T) map[string]bool {
	t.Helper()

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok, "runtime.Caller for package dir")
	dir := filepath.Dir(thisFile)

	entries, err := os.ReadDir(dir)
	require.NoError(t, err)

	fset := token.NewFileSet()
	declared := map[string]bool{}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || filepath.Ext(name) != ".go" || strings.HasSuffix(name, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, filepath.Join(dir, name), nil, 0)
		require.NoError(t, err)
		for _, d := range f.Decls {
			fd, ok := d.(*ast.FuncDecl)
			if !ok || fd.Recv == nil || len(fd.Recv.List) != 1 {
				continue
			}
			// Unwrap *Handler / Handler receiver expressions.
			ident, ok := fd.Recv.List[0].Type.(*ast.Ident)
			if star, ok2 := fd.Recv.List[0].Type.(*ast.StarExpr); ok2 {
				ident, ok = star.X.(*ast.Ident)
			}
			if ok && ident.Name == "Handler" {
				declared[fd.Name.Name] = true
			}
		}
	}
	return declared
}

// TestHandlerOverridesEveryDeclaredRPC walks the generated ServiceDesc and
// asserts each declared RPC has a Handler method — the Unimplemented embed
// would otherwise mask the gap and 501 the RPC at runtime.
func TestHandlerOverridesEveryDeclaredRPC(t *testing.T) {
	declared := handlerMethods(t)

	for _, m := range testkitv1.TestkitService_ServiceDesc.Methods {
		require.True(t, declared[m.MethodName],
			"RPC %s has no Handler method — inherited from UnimplementedTestkitServiceServer, it would 501; wire the handler",
			m.MethodName)
	}
}
