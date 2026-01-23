import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const register = () => {
    // Matches the backend route: router.post("/", ...) inside /auth
    api.post("/auth", { username, password }).then((response) => {
      if (response.data.error) {
        alert(response.data.error);
      } else {
        alert("Registration Successful! Please Login.");
        navigate("/login");
      }
    });
  };

  return (
    <div className="form-container">
      <h2>Register</h2>
      <input 
        type="text" 
        onChange={(e) => setUsername(e.target.value)} 
        placeholder="Username" 
      />
      <input 
        type="password" 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Password" 
      />
      <button onClick={register}>Register</button>
    </div>
  );
};