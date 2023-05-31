import axios from 'axios';
import { PAPER_URL_ROUTE } from "./common";

export const getPaperCitationCountsByDOI = async (dois) => {
    const doisFormatted = dois.map((doi) => 'DOI:'+doi);
    const url = PAPER_URL_ROUTE + 'batch?fields=citationCount,title,authors'

    const data = { ids: doisFormatted };
    const response = await axios.post(url, data);
    if(response.status === 200){
        let citationCounts = {}
        let authorIdDetails = {}
        response.data.forEach((entry, i) => {
            if(entry) {
                citationCounts[dois[i]] = entry.citationCount
                authorIdDetails[dois[i]] = entry.authors
            }
        })
        return {citationCounts, authorIdDetails};
    } else if(response.status === 429) {
        throw new Error('Too many requests');
    }
}

// getPaperCitationCountsByDOI(['10.46439/signaling.1.002']);