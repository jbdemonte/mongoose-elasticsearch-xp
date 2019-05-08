from elasticsearch:7.0.1

COPY --chown=elasticsearch:elasticsearch elasticsearch.yml /usr/share/elasticsearch/config/
RUN chown -R elasticsearch:elasticsearch /etc/
#RUN chown -R elasticsearch:elasticsearch /etc/elasticsearch
RUN chown -R elasticsearch:elasticsearch /usr/share/