package main

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
