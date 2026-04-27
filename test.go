package testing

func testing(list []int) []int {

	if len(list) == 0 {
		return []int{}
	}

	res := make([]int, len(list))

	for i := 0; i < len(list); i++ {
		val := 1
		for j := 0; j < len(list); j++ {
			if i == j {
				continue
			}
			val = val * list[j]
		}
		res[i] = val
	}
	// O(n^2)
	return res
}

// // No AI AutoComplete below
// func testingBetter(list []int) []int {

// 	if len(list) == 0 {
// 		return []int{}
// 	}

// 	res := make([]int, len(list))

// 	// O(n)

// 	return res
// }

func testingBetter(list []int) []int {

	if len(list) == 0 {
		return []int{}
	}

	res := make([]int, len(list))

	// O(n)

	// adding prefix multiplication to
	prefix := 1

	for i := 0; i < len(list); i++ {
		res[i] = prefix
		prefix *= list[i]
	}

	suffix := 1

	for i := len(list) - 1; i > 0; i-- {
		res[i] *= suffix
		suffix *= list[i]
	}

	return res
}

//Pinggy
// ssh -T -p 443 -R0:localhost:8089 a.pinggy.io

/*
"Hey Antigravity, I want you to perform a deep cleanup and optimization of our frontend codebase (frontend/src). Please execute the following sequence:"

Dead Code & Unused Imports: Scan all .ts, .tsx, and .css files. Identify and remove any unused imports, local variables, types, and components.
Debug cleanup: Search for and remove all console.log, console.warn, or commented-out code blocks that were used for debugging.
Design System Alignment: Verify that all components are using our standard design system tokens (e.g., Tailwind classes, CSS variables) rather than ad-hoc hex codes or styles, unless specifically required.
Aesthetic Audit: Review key pages for the "Premium WoW Factor" (ensure modern typography, smooth transitions, and mobile responsiveness are intact).
Type Safety: Audit any remaining any types or TypeScript warnings and refactor them into proper interfaces or types.
Consistent Naming: Ensure consistent naming conventions for components (PascalCase) and utilities (camelCase).
"Please provide a summary of the deleted code, the specific files modified, and any architectural improvements you made."
*/
