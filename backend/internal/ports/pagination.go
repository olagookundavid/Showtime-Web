package ports

// MaxPageSize caps what any single query will return, whatever the caller asks
// for. The transport layer clamps too, but the repository is the last line: a
// caller reaching a repo directly still cannot pull an entire table into memory.
const MaxPageSize = 200

// paging normalises the page/limit pair every listing query takes and works out
// the offset. Defined once so no two repositories disagree about what page 0 or
// a negative limit means.
//
// A limit of 0 or less falls back to the caller's default rather than returning
// nothing, which is almost never what a missing query param intends.
func paging(page, limit, defaultLimit int) (normalisedPage, normalisedLimit, offset int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	return page, limit, (page - 1) * limit
}
