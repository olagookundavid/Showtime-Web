package conversions

// func ToRoleRes(roles []domain.Role) dto.ListRoleResponse {
// 	var dtoRes []dto.DtoRoleRes

// 	for _, role := range roles {
// 		dtoRes = append(dtoRes, dto.DtoRoleRes{
// 			Id:          role.ID,
// 			Name:        role.Name,
// 			Description: role.Description,
// 		})
// 	}
// 	return dto.ListRoleResponse{
// 		Roles: dtoRes,
// 	}
// }

// func ToRoleDomain(roles []dto.DtoRole) []domain.Role {

// 	var domainRoles []domain.Role

// 	for _, role := range roles {
// 		domainRoles = append(domainRoles, domain.Role{
// 			Name:        role.Name,
// 			Description: role.Description,
// 		})
// 	}

// 	return domainRoles
// }
