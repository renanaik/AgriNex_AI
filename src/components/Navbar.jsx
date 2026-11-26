
import { Search, Bell, Leaf } from "lucide-react";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="brand">
        <Leaf size={24} />
        <h2>AgriNex</h2>
      </div>

      <div className="nav-links">
        <a href="#" className="active">Dashboard</a>
        <a href="#">Soil Analysis</a>
        <a href="#">Reports</a>
        <a href="#">History</a>
      </div>

      <div className="nav-actions">
        <Search size={20} />
        <Bell size={20} />

        <div className="profile">
          F
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
