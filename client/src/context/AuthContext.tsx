import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react"; // FIXED: Type-only import
import api from "../api";

interface AuthContextType {
  authState: { username: string; id: number; status: boolean };
  setAuthState: React.Dispatch<React.SetStateAction<{ username: string; id: number; status: boolean }>>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState({
    username: "",
    id: 0,
    status: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    
    if (token) {
      // FIXED: Now we use 'api' to verify the token is valid
      // This assumes your backend has the "GET /auth/auth" route from your original Users.js
      api.get("/auth/auth").then((response) => {
        if (response.data.error) {
          setAuthState({ username: "", id: 0, status: false });
        } else {
          setAuthState({
            username: response.data.username,
            id: response.data.id,
            status: true,
          });
        }
        setIsLoading(false);
      }).catch(() => {
        // If server is down or error occurs, log user out
        setAuthState({ username: "", id: 0, status: false });
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("accessToken");
    setAuthState({ username: "", id: 0, status: false });
  };

  return (
    <AuthContext.Provider value={{ authState, setAuthState, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};