import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { FormStateProvider, useFormState } from "./context/FormStateContext"; 
import { useContext, useEffect, useState } from "react"; // Added useEffect, useState
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { CreateSimple } from "./pages/CreateSimple";
import { CreateExperience } from "./pages/CreateExperience";
import { CreateJob } from "./pages/CreateJob";
import { EditJobRequirement } from "./pages/EditJobRequirement";

// ... [Imports remain the same] ...

const Navbar = () => {
    const { authState, logout } = useContext(AuthContext);
    const { isDirty, setIsDirty } = useFormState();
    const navigate = useNavigate();
    const location = useLocation();

    // --- Dark Mode Logic ---
    // Initialize state from localStorage or default to 'light'
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

    useEffect(() => {
        // Apply the theme to the HTML root element
        document.documentElement.setAttribute('data-theme', theme);
        // Persist to local storage
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    // -----------------------
  
    // Custom Navigation Handler
    const handleNavClick = (e: React.MouseEvent, path: string) => {
      e.preventDefault();
  
      if (isDirty) {
        if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
          return;
        }
        setIsDirty(false); 
      }
  
      if (location.pathname === path) {
        navigate(path, { state: { resetView: Date.now() } });
      } else {
        navigate(path);
      }
    };
  
    return (
      <nav className="nav-bar">
        <Link to="/" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--primary)" }}>
          Cov<span style={{color: "var(--text-main)"}}>Lette</span>
        </Link>
        <div className="nav-links">

          <a href="/add-job" onClick={(e) => handleNavClick(e, "/")} className="nav-link">Jobs</a>
          {!authState.status ? (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn-primary" style={{textDecoration:'none'}}>Get Started</Link>
            </>
          ) : (
            <>
              <a href="/add-experience" onClick={(e) => handleNavClick(e, "/add-experience")} className="nav-link">Experience</a>
              <a href="/add-skill" onClick={(e) => handleNavClick(e, "/add-skill")} className="nav-link">Skills</a>
              <a href="/add-job-tags" onClick={(e) => handleNavClick(e, "/add-job-tags")} className="nav-link">Tags</a>
              <button onClick={() => { 
                  if(isDirty && !window.confirm("Unsaved changes. Logout anyway?")) return;
                  setIsDirty(false);
                  logout(); 
              }} className="btn-secondary" style={{padding: "0.4rem 1rem"}}>Logout</button>
            </>
          )}
          
          {/* --- Theme Toggle Switch --- */}
          <label className="toggle-switch" title="Toggle Dark Mode">
            <input 
                type="checkbox" 
                checked={theme === 'dark'} 
                onChange={toggleTheme} 
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </nav>
    );
  };

// ... [Rest of App component stays the same] ...
function App() {
  return (
    <AuthProvider>
      <FormStateProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<CreateJob />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route 
              path="/add-skill" 
              element={
                <CreateSimple 
                  title="Skill" 
                  endpoint="/lists/skills" 
                />
              } 
            />

            <Route 
              path="/add-job-tags" 
              element={
                <CreateSimple 
                  title="Job Tag" 
                  endpoint="/lists/jobtags" 
                />
              } 
            />

            <Route path="/add-experience" element={<CreateExperience />} />
            <Route path="/edit-requirement" element={<EditJobRequirement />} />

          </Routes>
        </Router>
      </FormStateProvider>
    </AuthProvider>
  );
}

export default App;