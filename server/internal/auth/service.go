package auth

import (
	"errors"
	"strings"

	"cartografo-backend/internal/config"
	"cartografo-backend/internal/user"
)

// dummyHash lets login run a constant-time bcrypt comparison even when the
// email is unknown, preventing timing-based account enumeration.
const dummyHash = "$2a$10$invaliddummyhashfortiming.attack.prevention.only"

// Sentinel errors mapped by the handler to HTTP status codes.
var (
	ErrEmailTaken   = errors.New("email already registered")
	ErrInvalidCreds = errors.New("invalid credentials")
	ErrInvalidInput = errors.New("invalid input")
)

// Repository is the slice of user storage the auth service needs.
type Repository interface {
	Create(u *user.User) error
	FindByID(id string) (*user.User, error)
	FindByEmail(email string) (*user.User, error)
}

type Service struct {
	repo Repository
	jwt  config.JWTConfig
}

func NewService(repo Repository, jwtCfg config.JWTConfig) *Service {
	return &Service{repo: repo, jwt: jwtCfg}
}

type RegisterInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// UserDTO is the public projection of a user (never includes the hash).
type UserDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type AuthResult struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

func dto(u *user.User) UserDTO {
	return UserDTO{ID: u.ID, Name: u.Name, Email: u.Email}
}

func normalizeEmail(e string) string {
	return strings.ToLower(strings.TrimSpace(e))
}

func (s *Service) Register(in RegisterInput) (*AuthResult, error) {
	email := normalizeEmail(in.Email)
	if email == "" || !strings.Contains(email, "@") || len(in.Password) < 8 {
		return nil, ErrInvalidInput
	}

	if _, err := s.repo.FindByEmail(email); err == nil {
		return nil, ErrEmailTaken
	} else if !errors.Is(err, user.ErrNotFound) {
		return nil, err
	}

	hash, err := HashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = email
	}

	u := &user.User{Name: name, Email: email, PasswordHash: hash}
	if err := s.repo.Create(u); err != nil {
		return nil, err
	}

	return s.issue(u)
}

func (s *Service) Login(in LoginInput) (*AuthResult, error) {
	email := normalizeEmail(in.Email)
	u, err := s.repo.FindByEmail(email)
	if errors.Is(err, user.ErrNotFound) {
		// Run a dummy comparison so the response time does not reveal whether
		// the email exists.
		_ = CheckPassword(dummyHash, in.Password)
		return nil, ErrInvalidCreds
	}
	if err != nil {
		return nil, err
	}
	if err := CheckPassword(u.PasswordHash, in.Password); err != nil {
		return nil, ErrInvalidCreds
	}
	return s.issue(u)
}

// Me resolves the current user from a validated token's subject.
func (s *Service) Me(userID string) (*UserDTO, error) {
	u, err := s.repo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	d := dto(u)
	return &d, nil
}

func (s *Service) issue(u *user.User) (*AuthResult, error) {
	token, err := GenerateToken(u.ID, s.jwt.Secret, s.jwt.TTL)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: token, User: dto(u)}, nil
}
