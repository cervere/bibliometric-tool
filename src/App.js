import logo from './logo.svg';
import './App.css';
import React, { useEffect, useState, useMemo } from 'react';
import * as dfd from "danfojs"
import EnhancedTable from './PaginatedTable';
import EnhancedTableToolbar from './EnhancedTableToolbar';
import SearchFromSelect from './SearchFromSelect';
import {Typography, Button, Box, LinearProgress,
TableHead, TableRow, TableCell, TableBody, CircularProgress, Table} from '@mui/material';
import {updatePubsWithExternalData} from './utils/common/wrappers';
import {updateProgramInfo} from './utils/aamc-freida/programs';
import {updateDoximityUserInfo} from './utils/doximity/individual'
import {extractDOIorPMID} from './utils/common/regex-based';
import {FileDownload as FileDownloadIcon} from '@mui/icons-material';
import { ExportToCsv } from 'export-to-csv'; 
import DoneOutlineIcon from '@mui/icons-material/DoneOutline';
import ToggleButton from '@mui/material/ToggleButton';
import extractRowExport, {exportRowExport} from './utils/data-export/export';
import { getProgramInfo as getNSGYProgramInfo } from './utils/neurosurgery-match/program';

const constructDataFrame = async (pandasDF) => {
  /**
   * {id: {0: 'A', 1: 'B'},
   * name: {0: 'X', 1: 'Y'}}
   * 
   * NEEDED:
   * {
   * id: ['A', 'B'],
   * name: ['X', Y']}
   */
  const dataFrameObj = {};
  Object.keys(pandasDF).forEach((column) => {
    dataFrameObj[column] = []
    Object.keys(pandasDF[column]).forEach((idx) => {
      dataFrameObj[column].push(pandasDF[column][idx]);
    })
  });
  const dataFrame = await new dfd.DataFrame(dataFrameObj);
  return dataFrame;
}

const FIELDS_OF_INTEREST = [
"author_last_display_name", "author_last_education_name", 
"author_last_ama_program_name", "author_last_program_id", "author_last_position_rank", 
"author_first_display_name", "first_author_student", "author_first_edu_level",
"id_doi", "id_pmid", "title", "publication_date",
"author_last_affiliation_match",         "author_last_THA_city",
"author_last_THA_state",
"author_last_program_setting",
"author_last_num_residents_on_duty",
"author_last_director_phd"
]

const columnMetadata = [  
  {
    id: 'title',
    numeric: false,
    disablePadding: false,
    label: 'Title',
  },
  {
  id: 'publication_date',
  numeric: false,
  disablePadding: false,
  label: 'Publication Date',
  transform: (value) => {
    if(value && typeof value === 'number' && !Number.isNaN(value)) {
      return new Date(value).toISOString().split('T')[0]
    }
    return value;
  }
},
{
  id: 'id_doi',
  numeric: false,
  disablePadding: false,
  label: 'DOI',
  collapsible: true
},
{
  id: 'publication_citation_count',
  numeric: true,
  disablePadding: false,
  label: 'Citation Count',
},
  {
    id: 'author_first_display_name',
    numeric: false,
    disablePadding: false,
    label: 'First Author',
    collapsible: true
  },
  {
    id: 'author_first_edu_level',
    numeric: false,
    disablePadding: false,
    label: 'First Author Edu Level',
    transform: (value) => {
      const mapping = {
        'student?' : 'Student^', 
        'faculty' : 'Faculty', 
        'resident' : 'Resident', 
        'MD' : 'MD', 
        'fellow' : 'Fellow'
      }
      if(value && value !== '') {
        return mapping[value.toLowerCase()] || value;
      }
      return value;
    }
    },  
  // {
  //   id: 'first_author_student',
  //   numeric: false,
  //   disablePadding: false,
  //   label: 'Is First Author Student?',
  // },  
  {
    id: 'author_last_display_name',
    numeric: false,
    disablePadding: false,
    label: 'Last Author',
    collapsible: true
  }, {
    id: 'author_last_position_rank',
    numeric: false,
    disablePadding: false,
    label: 'Last Author Rank',
  },
  {
      id: 'author_last_education_name',
      numeric: false,
      disablePadding: true,
      label: 'Last Author Program',
      collapsible: true
    }
];



export const getProgramDisplay = (row) => {
  return (
    <Table size="small" aria-label="programs">
    <TableHead>
      <TableRow>
      <TableCell component="th" scope="row">
            ACGME ID
          </TableCell>
        <TableCell>No. of Physician Faculty</TableCell>
        <TableCell>No. of Non-Physician Faculty</TableCell>
        <TableCell> Female full-time Clinical Faculty (%)</TableCell>
        <TableCell >Avg. Work hrs/week</TableCell>
        <TableCell >Moonlighting Allowed</TableCell>
        <TableCell >Night Float</TableCell>
        <TableCell >Govt. Affiliated</TableCell>
        <TableCell >Applications Interviews-PGY1 ratio</TableCell>
      </TableRow>
    </TableHead>
    {
    row ?
    <TableBody>
      <TableRow>
    <TableCell component="th" scope="row">
            {row.program_id.split(':')[1].trim()}
          </TableCell>
        <TableCell>{row.fac_ft_paid_physician}</TableCell>
        <TableCell>{row.fac_ft_paid_non_physician}</TableCell>
        <TableCell>{row.fac_percent_ft_female}</TableCell>
        <TableCell>{row.work_avg_hrs_week}</TableCell>
        <TableCell>{row.work_moonlight}</TableCell>
        <TableCell>{row.work_nightfloat}</TableCell>
        <TableCell>{row.gov_affiliation}</TableCell>
        <TableCell>{row.appinfo_ratio_interviews_pgy1positions}</TableCell>
        </TableRow>
    </TableBody> :
    <CircularProgress size={20} style={{ marginRight: '0.5em' }} />
  }
  </Table>
  )
}


function App() {
    // initialize state for the data
    const [data, setData] = useState();
    const [rawData, setRawData] = useState();
    const [rawDataLoaded, setRawDataLoaded] = useState(false);
    const [fullDataLoaded, setFullDataLoaded] = useState(false);
    const [semanticAuthorIds, setSemanticAuthorIds] = useState();
    const [semanticAuthorInfo, setSemanticAuthorInfo] = useState();
    const [semanticPubCitationDataLoaded, setSemanticPubCitationDataLoaded] = useState(false);
    const [semanticAuthorInfoDataLoaded, setSemanticAuthorInfoDataLoaded] = useState(false);
    const [aamcProgramInfoDataLoaded, setAamcProgramInfoDataLoaded] = useState(false);
    const [semanticDataLoaded, setSemanticDataLoaded] = useState(false);
    const [iciteRCRDataLoaded, setIciteRCRDataLoaded] = useState(false);
    const [startYear, setStartYear] = useState(2013);
    const [programSearch, setProgramSearch] = useState();
    const [filteredData, setFilteredData] = useState();
    const [uniquePrograms, setUniquePrograms] = useState();
    const [programInfo, setProgramInfo] = useState();
    const [doximityUserData, setDoximityUserData] = useState();
    const [doximityUserDataLoaded, setDoximityUserDataLoaded] = useState();
    const [matchAffiliation, setMatchAffiliation] = useState(false);

    const filterRecords = (records, year, program) => {
      const filteredRecords = records?.filter((record) => {
        return new Date(record.publication_date).getFullYear() >= year
      })
      if(program && program.name?.trim() !== '') {
        return filteredRecords.filter((record) => (
          record.author_last_education_name?.includes(program.name)
        ))
      }
      return filteredRecords
    }

    const setFinalFlags = (semanticUpdate) => {
      console.log('>>> Just loaded semantic');
      // console.log(semanticUpdate?.updatedData[0]);
      setSemanticPubCitationDataLoaded(semanticUpdate.success?.pubCitations)
      setSemanticAuthorInfoDataLoaded(semanticUpdate.success?.authorInfo)
      setSemanticDataLoaded(semanticUpdate.success?.pubCitations && semanticUpdate.success?.authorInfo);
    }
  
    const getProgramInfo = (programId) => {
      if(programInfo) {
        return getProgramDisplay(programInfo[programId]);
      } else {

      }
    }
    // load data from JSON file
    useEffect(() => {
        fetch('https://raw.githubusercontent.com/cervere/bibliometric-tool-static/main/data/pubs_with_author_match.json')
        .then(response => response.json())
        .then(res_data => {
          // const dataFrame = new dfd.DataFrame(data);
          // console.log(dataFrame.columns);
          constructDataFrame(res_data).then((dataFrame) => {
            setDFs(dataFrame).then(() => {
              setFullDataLoaded(true);
            });
          });
        })
        .catch(error => console.error(error));
    }, [])

  const setDFs = async (df) => {
    const programNSGY = await getNSGYProgramInfo();
    console.log(programNSGY)
    const minifiedDF = await df.loc({columns: FIELDS_OF_INTEREST})
    setRawData(await dfd.toJSON(df));
    setRawDataLoaded(true);
    const loadedData = await dfd.toJSON(minifiedDF);
    setData(loadedData);
    // console.log('>>>>', loadedData.find((entry) => entry.authors && Object.keys(entry.authors).length > 0));
    // console.log(data.map((entry) => citations[extractDOI(entry.id_doi)]))

    let filteredData;
    if(matchAffiliation){
      filteredData = loadedData.filter((row) => row.author_last_affiliation_match);
    } else {
      filteredData = [...loadedData];
    }
    const programs = filteredData.map(
      (entry) => {
        return {id: entry.author_last_program_id, name: entry.author_last_education_name}
      });
    const programNames = programs.map(({name}) => name)
    const uniquePrograms = programs.filter(((entry, index) => programNames.indexOf(entry.name) === index));
    setUniquePrograms(uniquePrograms);
    setFilteredData(filteredData)
    // updatePubsWithExternalData(
    //   filteredData, 
    //   setFilteredData, 
    //   setSemanticAuthorIds, 
    //   setSemanticAuthorInfo,
    //   setFinalFlags,
    //   setIciteRCRDataLoaded
    // );
    updateProgramInfo(setProgramInfo, setAamcProgramInfoDataLoaded);
    updateDoximityUserInfo(setDoximityUserData, setDoximityUserDataLoaded);
    return true;
  }


  if(rawDataLoaded) {
    if(semanticDataLoaded) {
      
    } else {
    console.log('Semantic citations are being loaded...');
    }
    // setFilteredData(filterRecords(filteredData, startYear, programSearch));
  } 

  const handleYearChange = (event) => {
    setStartYear(event.target.value);
  };

  const handleExportData = (data, filtered=true) => {
    const csvOptions = {
      fieldSeparator: ',',
      quoteStrings: '"',
      decimalSeparator: '.',
      showLabels: true,
      useBom: true,
      useKeysAsHeaders: true,
      title: 'Publications_Authors',
      // headers: columnMetadata.map((c) => c.header),
    };
    let title = csvOptions.title;
    if(filtered) {
      if(programSearch?.name) {
        title = title + `_${programSearch.name}`
      } else {
        title = title + '_AllPrograms'
      }
      title = title + `_Since${startYear}`
    } else {
      title = title + '_AllPrograms_Since2013'
    }
    csvOptions.title = title; 
    csvOptions.filename = title;
    const csvExporter = new ExportToCsv(csvOptions);
    csvExporter.generateCsv(data);
  };


  const loadingFields = useMemo(() => {
    const fields = semanticDataLoaded ? []
          : semanticPubCitationDataLoaded ? ['author_first_display_name', 'author_last_display_name'] 
          : ['author_first_display_name', 'author_last_display_name', 'publication_citation_count'];
    if(!aamcProgramInfoDataLoaded) {
      fields.push('author_last_education_name');
    } 
    if(!iciteRCRDataLoaded) {
      fields.push('id_doi');
    }
    if(!doximityUserDataLoaded) {
      fields.push('doximity')
    }
    return fields;
  }, 
  [aamcProgramInfoDataLoaded, semanticDataLoaded, semanticPubCitationDataLoaded, iciteRCRDataLoaded,
    doximityUserDataLoaded])

  const allUpdatedData = useMemo(() => {
    let data ;
    if(matchAffiliation) {
      data = filteredData?.filter((row) => row.author_last_affiliation_match)
    } else {
      data = filteredData && [...filteredData]
    }
    return filterRecords(data, startYear, programSearch)
  }, 
  [filteredData, startYear, programSearch, matchAffiliation]);

  const dataToExport = useMemo(() => {
    if(semanticDataLoaded &&
      aamcProgramInfoDataLoaded &&
      iciteRCRDataLoaded && 
      doximityUserDataLoaded) {
      return filteredData.map((entry) => extractRowExport(entry, programInfo, doximityUserData))
    }

  }, [
    filteredData, 
    semanticDataLoaded, 
    aamcProgramInfoDataLoaded, 
    iciteRCRDataLoaded, 
    doximityUserDataLoaded, 
    programInfo,
    doximityUserData])

  const filteredDataToExport = useMemo(() => {
    if(dataToExport) {
      return allUpdatedData.map((entry) => extractRowExport(entry, programInfo, doximityUserData))
    }
  }, [allUpdatedData, dataToExport, programInfo, doximityUserData])

  return (
    <div className="App">
      <h1> Publications by program </h1>
      {allUpdatedData ?       
      (      
      <div className="content">      
        <EnhancedTableToolbar startYear={2013} year={startYear} handleYearChange={handleYearChange} />
        <SearchFromSelect sx={{alignItems: 'center'}} options={uniquePrograms} onSelect={setProgramSearch}/>
        <ToggleButton
      value="check"
      selected={matchAffiliation}
      onChange={() => {
        setMatchAffiliation(!matchAffiliation);
      }}
    >
      {matchAffiliation ? <DoneOutlineIcon /> : ''}
      <Typography>
      Last Author Affiliations
      </Typography>
    </ToggleButton>        
      <Box
          sx={{ display: 'flex', gap: '1rem', p: '0.5rem', flexWrap: 'wrap', flexDirection: 'row-reverse' }}
        >
        <Button
        disabled={!dataToExport}
            sx={{alignItems: 'left'}}
            color="primary"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            onClick={() => handleExportData(filteredDataToExport, true)}
            startIcon={<FileDownloadIcon />}
            variant="contained"
          >
            Export Filtered Data
        </Button>
        <Button
        disabled={!dataToExport}
            sx={{alignItems: 'left'}}
            color="primary"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            onClick={() => handleExportData(dataToExport, false)}
            startIcon={<FileDownloadIcon />}
            variant="contained"
          >
            Export All Data
        </Button>
        </Box>
        {
          (semanticDataLoaded && aamcProgramInfoDataLoaded) ? '' : <LinearProgress  />
        }
        <EnhancedTable 
        columnMetadata={columnMetadata} 
        rows={allUpdatedData} 
        loadingFields={loadingFields}
        getProgramInfo={getProgramInfo}
        doximityUserData={doximityUserData}
        />
        <Box
          sx={{ display: 'flex', gap: '1rem', p: '0.5rem', flexWrap: 'wrap', flexDirection: 'row-reverse' }}
        >
        <Button
        disabled={!doximityUserDataLoaded}
            sx={{alignItems: 'left'}}
            color="success"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            startIcon={
              doximityUserDataLoaded ? 
              <DoneOutlineIcon />
              : <CircularProgress />
            }
            variant="contained"
          >
            Doximity User Info
        </Button>
        <Button
        disabled={!iciteRCRDataLoaded}
            sx={{alignItems: 'left'}}
            color="success"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            startIcon={
              iciteRCRDataLoaded ? 
              <DoneOutlineIcon />
              : <CircularProgress />
            }
            variant="contained"
          >
            iCite NIH Publication Metrics
        </Button>
        <Button
        disabled={!aamcProgramInfoDataLoaded}
            sx={{alignItems: 'left'}}
            color="success"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            startIcon={
              aamcProgramInfoDataLoaded ? 
              <DoneOutlineIcon />
              : <CircularProgress />
            }
            variant="contained"
          >
            AAMC FREIDA Program INFO
        </Button>
        <Button
        disabled={!semanticPubCitationDataLoaded}
            sx={{alignItems: 'left'}}
            color="success"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            startIcon={
              semanticPubCitationDataLoaded ? 
              <DoneOutlineIcon />
              : <CircularProgress />
            }
            variant="contained"
          >
            SemanticScholar Publication Data
        </Button>
        {semanticPubCitationDataLoaded ? <Button
        disabled={!semanticAuthorInfoDataLoaded}
            sx={{alignItems: 'left'}}
            color="success"
            //export all data that is currently in the table (ignore pagination, sorting, filtering, etc.)
            startIcon={
              semanticAuthorInfoDataLoaded ? 
              <DoneOutlineIcon />
              : <CircularProgress />
            }
            variant="contained"
          >
            SemanticScholar Author Data
        </Button> :
        ''
       }
        </Box>      
        </div>
      )  :
      <div className="App-header">
        <div className="loader" >
        <img className="App-logo" src={logo} alt="logo" />
        <h1> Loading data...</h1>
       </div>
       </div>
      }
    </div>
  );
}

export default App;
