import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux"; 
import { store } from "./redux/store"; 
import Main from "./pages/main";

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter basename="/chatstructure">
        <Routes>
          <Route path="/" element={<Main />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
