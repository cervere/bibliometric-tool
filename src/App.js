import logo from './logo.svg';
import './App.css';
import React, { useEffect, useState } from 'react';

function App() {
    // initialize state for the data
    const [data, setData] = useState([]);

    // load data from JSON file
    useEffect(() => {
      fetch('https://github.com/jgreis23/MedEd-Bibliometrics-NSGY/blob/277ad81f0c02f322f79cc0e7e8fea295004d5d9f/Data/pubs_from_2013_foi.json')
      .then(response => response.json())
      .then(data => {
        console.log('Received data')
        setData(data);
      });
    })


  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

      <h1>My Data</h1>
      <span>
        {data.length} Records
      </span>
      </header>
    </div>
  );
}

export default App;
